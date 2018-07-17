
var archiver = require('archiver');
var await = require('await');
var fs = require('fs');
var glob = require('glob');
var log = require('log4js').getLogger();
var path = require('path');
var utils = require('./utils');
var xmlParser = require('xml-js');

log.level = 'debug';

//
// Find OCTGN Directory if possible, assuming Windows and normal c:\users\<username> install.
// If this is not the case, the gameDir variable will be have to set manually in this script
//
var userName = process.env['USERPROFILE'].split(path.sep)[2];
var gameDir = "C:/Users/" + userName + "/Documents/OCTGN/GameDatabase/a6d114c7-2e2a-4896-ad8c-0330605c90bf"
if (!fs.existsSync(gameDir)) {
    log.error("Couldn't find OCTGN install directory, you'll have to set the 'gameDir' variable manually");
    return;
}

var setDir = gameDir + "/Sets"

//
// Create the images directory if necessary
//
utils.mkdir("./images/a6d114c7-2e2a-4896-ad8c-0330605c90bf/Sets");

//
// JSON object output to json/octgn.json at the end which maps OCTGN set ID to name
//
var octgnJson = {};

//
// Loop through OCTGN set directory and read all the set.xml files within to process
//
fs.readdirSync(setDir).forEach(function(set) {
   
    //
    // Uncomment below, and comment out the loop to run a single set
    //
    // var set = "dfa9b3bf-58f2-4611-ae55-e25562726d62";

    //
    // Make sure the output directories are created
    //
    imageDir = 'images/a6d114c7-2e2a-4896-ad8c-0330605c90bf/Sets/' + set + "/Cards/";
    utils.mkdir(imageDir);

    //
    // Delete old files in the directory if there are any
    //
    fs.readdirSync(imageDir).forEach(function(file) {
        fs.unlinkSync("./" + imageDir + file);
    });

    //
    // Read in the set.xml file for the given set
    //
    var xml = fs.readFileSync(setDir + "/"+ set + "/set.xml", "utf-8");

    //
    // Parse the XML into JSON
    //
    var json = JSON.parse(xmlParser.xml2json(xml), {
        ignoreDeclaration: true,
        textKey: 'value',
        cdataKey: 'value',
        commentKey: 'value'
    });

    //
    // Make sure the set is in the ArkhamDB data as otherwise we can't get 
    // cards for it (like for Markers and Tokens, for example)
    //
    if (!utils.findSetByName(json.elements[0].attributes.name)) {
        log.warn("No such set " + json.elements[0].attributes.name + " in ArkhamDB data");
        return;
    }

    //
    // Save OCTGN ID for later output in a JSON file
    //
    octgnJson[json.elements[0].attributes.name] = json.elements[0].attributes.id;

    //
    // Only download cards if the zip file doesn't already exist from a previous run
    //
    if(fs.existsSync("./images/" + json.elements[0].attributes.name + ".zip")) {
        log.warn("Set " + json.elements[0].attributes.name + " already downloaded, skipping");
        return;
    }

    log.info("-----------------------------------------------------------------");
    log.info("Processing set " + json.elements[0].attributes.name + " (" + json.elements[0].attributes.id + ")");
    log.info("-----------------------------------------------------------------");

    //
    // Promise that is fulfilled once all the cards in a set have been processed
    //
    var promise = await("loop");

    //
    // Loop through the cards in the set
    //
    var errorCount = 0;
    var downloadCount = 0;
    var totalCards = 0;
    for (var i in json.elements[0].elements[0].elements) {

        var card = json.elements[0].elements[0].elements[i];

        //
        // Strip out HTML encoded stuff (may be missing some things here and there's
        // likely a native function that can accomplish this better)
        //
        var name = card.attributes.name.replace(/&quot;/g, "\"");

        //
        // Attempt to look up the card from the ArkhamDB JSON by name
        //
        var arkhamDbCard = utils.findCardByNumberAndSetName(utils.getCardNumber(card), json.elements[0].attributes.name);

        //
        // Couldn't find the card for some reason, log the error
        //
        if (!arkhamDbCard) {
            log.error("Could not find card: " + name + " (" + card.attributes.id + ")");
            errorCount++;
            totalCards++;
        }
        //
        // Found the card in the API data, attempt to process it
        //
        else {

            log.info("Found card " + name + " (" + card.attributes.id + ") :: (" + arkhamDbCard.url + "), downloading...");
            
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

                totalCards++;

                //
                // Initiate image download of the front of the card
                //
                utils.downloadCardImage(
                    'https://arkhamdb.com/' + arkhamDbCard.imagesrc,
                    imageDir + card.attributes.id + '.jpg')
                //
                // The download was successful
                //
                .then(function(got) {

                    downloadCount++;

                    //
                    // This is the logic to know when to fulfill the promise created above
                    // which is repeated a lot, this needs to be done more elegantly
                    //
                    if (downloadCount + errorCount >= totalCards) {
                        promise.keep("loop", {
                            "set": json.elements[0].attributes.name,
                            "directory": "images/a6d114c7-2e2a-4896-ad8c-0330605c90bf/Sets/" + json.elements[0].attributes.id + "/Cards/"
                        });
                    }

                })
                //
                // The download failed for some reason, log it
                //
                .catch(function(error) {

                    log.error("Error downloading " + name);
                    log.error(error);
                    errorCount++;

                    //
                    // This is the logic to know when to fulfill the promise created above
                    // which is repeated a lot, this needs to be done more elegantly
                    //
                    if (downloadCount + errorCount >= totalCards) {
                        promise.keep("loop", {
                            "set": json.elements[0].attributes.name,
                            "directory": "images/a6d114c7-2e2a-4896-ad8c-0330605c90bf/Sets/" + json.elements[0].attributes.id + "/Cards/"
                        });
                    }

                });
            }

            //
            // This card also has a back image so download that, too
            //
            if (arkhamDbCard.backimagesrc) {

                totalCards++;

                //
                // Initiate download of the back of the card
                //
                utils.downloadCardImage(
                    'https://arkhamdb.com/' + arkhamDbCard.backimagesrc,
                    imageDir + card.attributes.id + '.B.jpg')
                //
                // The download was successful
                //
                .then(function(got) {

                    downloadCount++;                

                    //
                    // This is the logic to know when to fulfill the promise created above
                    // which is repeated a lot, this needs to be done more elegantly
                    //
                    if (downloadCount + errorCount >= totalCards) {
                        promise.keep("loop", {
                            "set": json.elements[0].attributes.name,
                            "directory": "images/a6d114c7-2e2a-4896-ad8c-0330605c90bf/Sets/" + json.elements[0].attributes.id + "/Cards/"
                        });
                    }

                })
                //
                // The download failed for some reason, log it
                //
                .catch(function(error) {

                    log.error("Error downloading " + name);
                    log.error(error);
                    errorCount++;

                    //
                    // This is the logic to know when to fulfill the promise created above
                    // which is repeated a lot, this needs to be done more elegantly
                    //
                    if (downloadCount + errorCount >= totalCards) {
                        promise.keep("loop", {
                            "set": json.elements[0].attributes.name,
                            "directory": "images/a6d114c7-2e2a-4896-ad8c-0330605c90bf/Sets/" + json.elements[0].attributes.id + "/Cards/"
                        });
                    }

                });
            }

        }
    }

    //
    // This happens when the promise created above is fulfilled (the set has finished
    // downloading/processing each card in set.xml)
    //
    promise.then(function(got) {

        log.info("Finished downloading " + got.loop.set + ", zipping images");

        //
        // Create zip file
        //
        var output = fs.createWriteStream("images/" + got.loop.set + ".zip");
        var archive = archiver("zip", {
            zlib: { level: 1 }
        });

        //
        // Write all the set's images to the zip file
        //
        archive.pipe(output);
        archive.directory(got.loop.directory, got.loop.directory.replace(/^images\//, ""));
        archive.finalize();

        log.info("Zip file images/" + got.loop.set + ".zip created");

    });
    
});

//
// Write octgnJson to file
//
fs.writeFileSync("./json/octgn.json", JSON.stringify(octgnJson, null, 4));
