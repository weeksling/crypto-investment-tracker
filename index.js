var Airtable = require('airtable');
var express = require('express');
var router = express.Router();              
var app = express();
var request = require('request');
var PORT = process.env.PORT || 8080;
var http = require('http');
var server = http.createServer(app);

const AIRTABLE_API_KEY      = process.env.AIRTABLE_API_KEY;
const AIRTABLE_BASE_ID      = process.env.AIRTABLE_BASE_ID;
const BASE_CURRENCY         = process.env.BASE_CURRENCY;
const APP_NAME              = process.env.APP_NAME;

// Set up airtable API
var base = new Airtable({ apiKey: AIRTABLE_API_KEY }).base(AIRTABLE_BASE_ID);

// Ping the site every five minutes to keep it from idling.
setInterval(function() {
    http.get("http://"+APP_NAME+".herokuapp.com");
}, 300000); 

// Fetch the rates from CryptoCompare
function getPrice(currencyName, baseCurrency, callback) {
    request({
      uri: "https://min-api.cryptocompare.com/data/price?fsym="+currencyName+"&tsyms="+baseCurrency,
      method: "GET",
      timeout: 10000,
    }, function(error, resp, body) {
        
      var jsonObject = JSON.parse(body);
      callback(jsonObject[baseCurrency]);
    });
}

// Helper function for updating airtable rates
function updatePrice(newRate, timeStamp, id) {
    base('Currencies').update(id, {
      'Price': newRate,
      'Last updated': timeStamp
    }, function(err, record) {
      if (err) { console.error('Error updating price', err); return; }
      console.log(record);
    });
}

// Update Airtable with rates from Open Exchange
function updateCurrenciesAirtable() {
    console.info('Updating Air Table')
    base('Currencies').select({
      // Selecting the first 3 records in Main View:
      view: 'All Currencies'
    }).eachPage(function page(records, fetchNextPage) {

      // Loop through each record and update the currency
      records.forEach(function updateRecords(record) {

        // Get the ID
        var id = record['_rawJson']['id'];
        
        // Get the name
        var name = record.get('Symbol');

        var timeStamp = new Date(); 

        getPrice(name, BASE_CURRENCY, function(rate){
          updatePrice(rate, timeStamp.toISOString(), id);
        });
        
      });

      fetchNextPage();
    }, function done(error) {
      if (error) {
          console.log('Error while looping through Pages', error);
      }
    });
}

console.info('Setting up our interval...')
// Fetch rates every 10 minutes
setInterval(function() {
  updateCurrenciesAirtable();
}, 600000);

server.listen(PORT, function(error) {
  console.info('Starting server')
    if (error) {
      console.error('Error whil starting server', error);
    } else {
      updateCurrenciesAirtable();
      console.log("==> 🌎  Listening on port %s. Visit http://localhost:%s/ in your browser.", PORT, PORT);
    }

});


