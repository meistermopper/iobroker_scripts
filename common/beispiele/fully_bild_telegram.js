var request = require('request');
var fs      = require('fs');
var vUser = "Thomas";
        request.get({url: 'http://192.192.178.235:2323/?cmd=getCamshot&password=DBtRkL', encoding: 'binary'}, function (err, response, body) {
            fs.writeFile("/opt/iobroker/backups/snap.jpg", body, 'binary', function(err) {
                if (err) {
                    console.error(err);
                } else {
                    var info_text = 'Ein neues Bild';
                    console.log('Snapshot sent');
                    sendTo('telegram.0', {user: vUser, text: '/opt/iobroker/backups/snap.jpg', caption: info_text });
                }
            });
        });