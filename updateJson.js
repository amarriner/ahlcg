
const fs = require("fs");
const request = require("sync-request");

const jsonDir = "./json/";
const arkhamPacksUrl = "https://arkhamdb.com/api/public/packs/";

console.log("Beginning Arkham Horror card refresh");
var packs = JSON.parse(request("GET", arkhamPacksUrl).getBody());

var all = [];
for (var i in packs) {

    console.log("Downloading " + packs[i].name);
    var cardsUrl = "https://arkhamdb.com/api/public/cards/" + packs[i].code + ".json";
    var cards = JSON.parse(request("GET", cardsUrl).getBody());

    all = all.concat(cards);

    if (packs[i].name === "Books") {
        packs[i].name = "Book Series";
    }

    if (packs[i].name === "The Dunwich Legacy") {
        packs[i].name = "Dunwich Legacy";
    }
}

fs.writeFileSync(jsonDir + "arkham-cards.json", JSON.stringify(all));
fs.writeFileSync(jsonDir + "arkham-packs.json", JSON.stringify(packs));
console.log(all.length + " total Arkham Horror cards");
