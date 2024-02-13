const swearjar = require("swearjar");
const metadata = require("./_data/metadata.js");
const Twitter = require("./src/twitter");
const EmojiAggregator = require( "./src/EmojiAggregator" );
const dataSource = require("./src/DataSource");

class Index extends Twitter {
	data() {
		return {
			layout: "layout.11ty.js"
		};
	}

	getTopUsersToRetweets(tweets) {
		let users = {};
		for(let tweet of tweets) {
			if(!this.isRetweet(tweet)) {
				continue;
			}

			if(tweet.entities && tweet.entities.user_mentions && tweet.entities.user_mentions[0]) {
				let username = tweet.entities.user_mentions[0].screen_name;
				if(!users[username]) {
					users[username] = {
						count: 0,
						username: username
					};
				}
				users[username].count++;
			}
		}

		return Object.values(users).sort((a, b) => b.count - a.count);
	}

	getTopReplies(tweets) {
		let counts = {};
		for( let tweet of tweets ) {
			let username = tweet.in_reply_to_screen_name;
			if(username && username !== metadata.username) {
				if(!counts[username]) {
					counts[username] = {
						count: 0,
						username: username
					};
				}

				counts[username].count++;
			}
		}

		return Object.values(counts).sort((a, b) => b.count - a.count);
	}

	getTopMentions(tweets) {
		let counts = {};
		for( let tweet of tweets ) {
			if(this.isMention(tweet)) {
				let username = tweet.full_text.trim().split(" ").shift();
				username = username.substr(1);
				if(username && username !== metadata.username) {
					if(!counts[username]) {
						counts[username] = {
							count: 0,
							username: username
						};
					}

					counts[username].count++;
				}
			}
		}

		return Object.values(counts).sort((a, b) => b.count - a.count);
	}

	renderSwearWord(word) {
		return word.split("").map((letter, index) => index === 1 ? "_" : letter).join("");
	}

	getSwearWordsFromText(text) {
		let splits = swearjar.censor(text).split(/([\*]+)/g);
		let swears = {};

		let index = 0;
		for(let split of splits) {
			if( split.length > 1 && split.match(/[\*]+/) ) {
				let word = text.substr(index, split.length).toLowerCase();
				if(!swears[word]) {
					swears[word] = 0;
				}
				swears[word]++;
			}
			index += split.length;
		}
		return swears;
	}

	//, includeReplies = true
	getTopSwearWords(tweets = []) {
		let words = {};
		tweets.filter(tweet => {
			return !this.isRetweet(tweet) && swearjar.profane(tweet.full_text);
		}).forEach(tweet => {
			let swears = this.getSwearWordsFromText(tweet.full_text);
			for(let swear in swears) {
				if(!words[swear]) {
					words[swear] = {
						count: 0,
						word: swear,
						tweets: []
					};
				}
				words[swear].count += swears[swear];
				words[swear].tweets.push(tweet);
			}
		});

		return Object.values(words).sort((a, b) => {
			return b.count - a.count;
		});
	}

	getHashTagsFromText(text = "") {
		let words = {};
		let splits = text.split(/(\#[A-Za-z][^\s\.\'\"\!\,\?\;\}\{]*)/g);
		for(let split of splits) {
			if(split.startsWith("#")) {
				let tag = split.substr(1).toLowerCase();
				if(!words[tag]) {
					words[tag] = 0;
				}
				words[tag]++;
			}
		}
		return words;
	}

	getTopHashTags(tweets = []) {
		let words = {};
		tweets.filter(tweet => {
			return !this.isRetweet(tweet) && tweet.full_text.indexOf("#");
		}).forEach(tweet => {
			let tags = this.getHashTagsFromText(tweet.full_text);
			for(let tag in tags) {
				if(!words[tag]) {
					words[tag] = {
						count: 0,
						tag: tag,
						tweets: []
					};
				}
				words[tag].count += tags[tag];
				words[tag].tweets.push(tweet);
			}
		});

		return Object.values(words).sort((a, b) => {
			return b.count - a.count;
		});
	}

	getAllLinks(tweets = []) {
		let links = [];
		for(let tweet of tweets) {
			let tweetLinks = this.getLinkUrls(tweet);
			for(let link of tweetLinks) {
				links.push(link);
			}
		}
		return links;
	}

	getTopHosts(tweets = []) {
		let topHosts = {};
		for(let tweet of tweets) {
			let links = this.getLinkUrls(tweet);
			for(let entry of links) {
				if(!topHosts[entry.host]) {
					topHosts[entry.host] = Object.assign({
						count: 0
					}, entry);
				}
				topHosts[entry.host].count++;
			}
		}

		let arr = [];
		for(let entry in topHosts) {
			arr.push(topHosts[entry]);
		}

		return arr.sort((a, b) => b.count - a.count);
	}

	getTopDomains(tweets = []) {
		let topDomains = {};
		for(let tweet of tweets) {
			let links = this.getLinkUrls(tweet);
			for(let entry of links) {
				if(!topDomains[entry.domain]) {
					topDomains[entry.domain] = Object.assign({
						count: 0
					}, entry);
				}
				topDomains[entry.domain].count++;
			}
		}

		let arr = [];
		for(let entry in topDomains) {
			arr.push(topDomains[entry]);
		}

		return arr.sort((a, b) => b.count - a.count);
	}

	async render(data) {
		let {transform: twitterLink} = await import("@tweetback/canonical");

		let tweets = await dataSource.getAllTweets();
		let last12MonthsTweets = tweets.filter(tweet => tweet.date - new Date(Date.now() - 1000*60*60*24*365) > 0);

		let tweetCount = tweets.length;
		let retweetCount = tweets.filter(tweet => this.isRetweet(tweet)).length;
		let noRetweetsTweetCount = tweets.length - retweetCount;
		let replyCount = tweets.filter(tweet => this.isReply(tweet)).length;
		let mentionNotReplyCount = tweets.filter(tweet => this.isMention(tweet)).length;
		// let ambiguousReplyMentionCount = tweets.filter(tweet => this.isAmbiguousReplyMention(tweet)).length;
		let retweetsEarnedCount = tweets.filter(tweet => !this.isRetweet(tweet)).reduce((accumulator, tweet) => accumulator + parseInt(tweet.retweet_count, 10), 0);
		let likesEarnedCount = tweets.filter(tweet => !this.isRetweet(tweet)).reduce((accumulator, tweet) => accumulator + parseInt(tweet.favorite_count, 10), 0);

		let topSwears = this.getTopSwearWords(tweets);
		let swearCount = topSwears.reduce((accumulator, obj) => accumulator + obj.count, 0);
		let tweetSwearCount = topSwears.reduce((accumulator, obj) => accumulator + obj.tweets.length, 0);

		let topHashes = this.getTopHashTags(tweets);
		let hashCount = topHashes.reduce((accumulator, obj) => accumulator + obj.count, 0);
		let tweetHashCount = topHashes.reduce((accumulator, obj) => accumulator + obj.tweets.length, 0);

		const emoji = new EmojiAggregator();
		for(let tweet of tweets) {
			if( !this.isRetweet(tweet) ) {
				emoji.add(tweet);
			}
		}
		let emojis = emoji.getSorted();
		let mostRecentTweets = tweets.filter(tweet => this.isOriginalPost(tweet)).sort(function(a,b) {
				return b.date - a.date;
			}).slice(0, 15);
		let recentTweetsHtml = await Promise.all(mostRecentTweets.map(tweet => this.renderTweet(tweet)));
		let mostPopularTweetsHtml = await Promise.all(this.getMostPopularTweets(tweets).slice(0, 6).map(tweet => this.renderTweet(tweet, { showPopularity: true })));

		let links = this.getAllLinks(tweets);
		let linksCount = links.length;
		let httpsLinksCount = links.filter(entry => entry.origin.startsWith("https:")).length;

		let links12Months = this.getAllLinks(last12MonthsTweets);
		let linksCount12Months = links12Months.length;
		let httpsLinksCount12Months = links12Months.filter(entry => entry.origin.startsWith("https:")).length;
		return `
		<h2 class="tweets-primary-count">
			<span class="tweets-primary-count-num">${this.renderNumber(tweetCount)}</span> tweet${tweetCount !== 1 ? "s" : ""}
		</h2>

		<is-land on:visible on:save-data="false">
			<template data-island>
				<h2>Search Tweets:</h2>
				<div class="tweets-search">
					<div id="search" class="tweets-search"></div>
					<link href="/_pagefind/pagefind-ui.css" rel="stylesheet">
					<script src="/_pagefind/pagefind-ui.js" onload="new PagefindUI({ element: '#search', showImages: false });"></script>
				</div>
			</template>
		</is-land>

		<div>
			<h2><a href="/recent/">Recent:</a></h2>

			<ol class="tweets tweets-linear-list h-feed hfeed" id="tweets-recent-home">
				${recentTweetsHtml.join("")}
			</ol>
		</div>

		<div>
			<h2><a href="/popular/">Popular:</a></h2>
			<ol class="tweets tweets-linear-list">
				${mostPopularTweetsHtml.join("")}
			</ol>
		</div>

		<h2 id="shared">My tweets have been given about <span class="tag tag-lite tag-retweet">♻️ ${this.renderNumber(retweetsEarnedCount)}</span> retweets and <span class="tag tag-lite tag-favorite">❤️ ${this.renderNumber(likesEarnedCount)}</span> likes</h2>

		<template id="rendered-twitter-link"><a href="/1234567890123456789/">twitter link</a></template>
`;
		// <h3>Before 2012, it was not possible to tell the difference between a mention and reply. This happened ${this.renderNumber(ambiguousReplyMentionCount)} times (${this.renderPercentage(ambiguousReplyMentionCount, tweetCount)})</h3>

		// <h3>I’ve sent someone a mention ${this.renderNumber(mentionNotReplyCount)} times (${this.renderPercentage(mentionNotReplyCount, tweetCount)})</h3>
		// <p>Mentions are tweets sent to a single person but not as a reply to an existing tweet. Note that this number is overinflated for old data—Twitter didn’t support official replies before July 2012.</p>
	}
}

module.exports = Index;
