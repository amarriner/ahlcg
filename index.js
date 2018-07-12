
var archiver = require('archiver');
var await = require('await');
var fs = require('fs');
var log = require('log4js').getLogger();
var utils = require('./utils');
var xmlParser = require('fast-xml-parser');

log.level = 'debug';
var gameDir = "C:/Users/marrinea/Documents/OCTGN/GameDatabase/a6d114c7-2e2a-4896-ad8c-0330605c90bf"
var setDir = gameDir + "/Sets"

fs.readdirSync(setDir).forEach(function(set) {
   
    //
    // Uncomment below, and comment out the loop to run a single set
    //
    // var set = "dfa9b3bf-58f2-4611-ae55-e25562726d62";

    //
    // Make sure the set directories are created
    //
    imageDir = 'images/a6d114c7-2e2a-4896-ad8c-0330605c90bf/Sets/' + set;
    if (!fs.existsSync(imageDir)) {
        fs.mkdirSync(imageDir);
    }

    imageDir += "/Cards/";
    if (!fs.existsSync(imageDir)) {
        fs.mkdirSync(imageDir);
    }

    //
    // Read in the set.xml file for the given set
    //
    var xml = fs.readFileSync(setDir + "/"+ set + "/set.xml", "utf-8");

    var options = {
        attributeNamePrefix : "",
        attrNodeName: "attr",
        textNodeName : "#text",
        ignoreAttributes : false,
        ignoreNameSpace : false,
        allowBooleanAttributes : false,
        parseNodeValue : true,
        parseAttributeValue : true,
        trimValues: true,
        cdataTagName: "__cdata",
        cdataPositionChar: "\\c",
        localeRange: ""
    };

    //
    // Parse the XML into JSON
    //
    var json = xmlParser.parse(xml, options);

    //
    // Make sure the set is in the ArkhamDB data as otherwise we can't get 
    // cards for it (like for Markers and Tokens, for example)
    //
    if (!utils.findSetByName(json.set.attr.name)) {
        log.warn("No such set " + json.set.attr.name + " in ArkhamDB data");
        return;
    }

    //
    // Only download cards if the zip file doesn't already exist from a previous run
    //
    if(fs.existsSync("./images/" + json.set.attr.name + ".zip")) {
        log.warn("Set " + json.set.attr.name + " already downloaded, skipping");
        return;
    }

    //
    // Loop through the cards in the set
    //
    log.info("-----------------------------------------------------------------");
    log.info("Processing set " + json.set.attr.name + " (" + json.set.attr.id + ")");
    log.info("-----------------------------------------------------------------");
    var promise = await("loop");
    for (var i in json.set.cards.card) {

        var errorCount = 0;
        var downloadCount = 0;
        var card = json.set.cards.card[i];

        //
        // String out HTML encoded stuff (may be missing some things here and there's
        // likely a native function that can accomplish this better)
        //
        var name = card.attr.name.replace(/&quot;/g, "\"");

        //
        // Attempt to look up the card from the ArkhamDB JSON by name
        //
        var arkhamDbCard = utils.findCardByName(name);

        if (!arkhamDbCard) {            
            if (card.alternate.attr.name) {
                arkhamDbCard = utils.findCardByName(card.alternate.attr.name.replace(/&quot;/g, "\""));
            }
        }

        if (!arkhamDbCard) {
            log.error("Could not find card: " + name + " (" + card.attr.id + ")");
            errorCount++;
        }
        else {

            log.info("Found card " + name + " (" + card.attr.id + ") :: (" + arkhamDbCard.url + "), downloading...");
            
            //
            // If the card is a location, flip the imagesrc and backimagesrc attributes
            //
            if (arkhamDbCard.type_code === "location" && arkhamDbCard.backimagesrc) {
                var t = arkhamDbCard.backimagesrc;
                arkhamDbCard.backimagesrc = arkhamDbCard.imagesrc;
                arkhamDbCard.imagesrc = t;
            }

            //
            // Found the card, attempt to download it
            //
            if (arkhamDbCard.imagesrc) {
                utils.downloadCardImage(
                    'https://arkhamdb.com/' + arkhamDbCard.imagesrc,
                    imageDir + card.attr.id + '.jpg'
                ).then(function(got) {

                    downloadCount++;

                    if (downloadCount + errorCount >= json.set.cards.card.length) {
                        promise.keep("loop", {
                            "set": json.set.attr.name,
                            "directory": imageDir
                        });
                    }

                }).catch(function(error) {

                    log.error("Error downloading " + name);
                    log.error(error);
                    errorCount++

                });
            }

            //
            // This card also has a back image so download that, too
            //
            if (arkhamDbCard.backimagesrc) {
                utils.downloadCardImage(
                    'https://arkhamdb.com/' + arkhamDbCard.backimagesrc,
                    imageDir + card.attr.id + '.B.jpg'
                ).then(function(got) {

                    downloadCount++;                

                    if (downloadCount + errorCount >= json.set.cards.card.length) {
                        promise.keep("loop", {
                            "set": json.set.attr.name,
                            "directory": imageDir
                        });
                    }

                }).catch(function(error) {

                    log.error("Error downloading " + name);
                    log.error(error);
                    errorCount++

                });
            }

        }
    }

    promise.then(function(got) {

        log.info("Finished downloading " + got.loop.set + ", zipping images");

        var output = fs.createWriteStream("images/" + got.loop.set + ".zip");
        var archive = archiver("zip", {
            zlib: { level: 1 }
        });

        archive.pipe(output);
        archive.directory(got.loop.directory, got.loop.directory.replace(/^images\//, ""));
        archive.finalize();

        log.info("Zip file images/" + got.loop.set + ".zip created");

    });
    
});
