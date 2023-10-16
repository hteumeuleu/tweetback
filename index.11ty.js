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

	async render(data) {
		return `Hello world!`
	}
}

module.exports = Index;
