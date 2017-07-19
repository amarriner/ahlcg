var await = require('await');
var download = require('image-downloader');
var fs = require('fs');
var log = require('log4js').getLogger();
var request = require('request');

log.level = 'debug';

var set = {
    name: 'Where Doom Awaits',
    code: 'wda',
    octgnId: '00351560-5d00-35f9-991c-cee41e081de5'
};

var imageDir = 'images/a6d114c7-2e2a-4896-ad8c-0330605c90bf/Sets/' + set.octgnId + '/Cards/';

var apiUrl = 'https://arkhamdb.com/api/public/cards/' + set.code + '.json';

if (!fs.existsSync(imageDir)) {
    fs.mkdirSync(imageDir.replace('Cards/', ''));
    fs.mkdirSync(imageDir);
}

var getCards = function() {

    var promise = await('cards');
    log.info('Retrieving cards...');

    request.get({
        url: apiUrl
    }, function (error, response, body) {

        if (error || ! response.statusCode === 200) {
            log.error('Error retrieving cards!');
            promise.fail(response.statusCode + ' :: ' + response.body);
            return;
        }

        log.info('Retrieved cards...');
        promise.keep('cards', response.body);

    });

    return promise;

};

// ----------------------------------------------------------------------------

log.info('START');

getCards()
    .then(function(got) {

        var json = JSON.parse(got.cards);
        // log.info(JSON.stringify(json));

        for (var i = 0; i < json.length; i++) {

            var downloaded = false;
            log.info(json[i]['name'] + ' :: ' + json[i]['imagesrc'] + ' :: ' + json[i]['octgn_id']);

            if (json[i]['imagesrc']) {
                download.image({
                    url: 'https://arkhamdb.com/' + json[i]['imagesrc'],
                    dest: imageDir + json[i]['octgn_id'] + '.jpg'
                }).then(function(filename, image) {
                    //log.debug('Downloaded ' + JSON.stringify(filename));
                }).catch(function(error) {
                    log.error('Error downloading (' + error + ')');
                });

                downloaded = true;
            }

            if (json[i]['backimagesrc']) {
                download.image({
                    url: 'https://arkhamdb.com/' + json[i]['backimagesrc'],
                    dest: imageDir + json[i]['octgn_id'] + '.B.jpg'
                }).then(function(filename, image) {
                    //
                }).catch(function(error) {
                    log.error('Error downloading (' + error + ')');
                });

                downloaded = true;
            }

            if (!downloaded) {
                log.warn('Did not attempt download: ' + json[i]['name'] + ' :: ' + json[i]['code'] + ' :: ' + json[i]['octgn_id']);
            }
        }

        log.info('DONE');

    })
    .catch(function(error) {

        log.error(error);

    });

