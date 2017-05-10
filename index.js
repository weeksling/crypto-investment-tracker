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
const TIME_INTERVAL_UPDATE  = 1400; // Every 24 hours
const BASE_CURRENCY         = 'USD';

// Set up airtable
var base = new Airtable({ apiKey: AIRTABLE_API_KEY }).base(AIRTABLE_BASE_ID);

// Set TIME_INTERVAL_UPDATE value
var the_interval = TIME_INTERVAL_UPDATE * 60 * 1000;
setInterval(function() {
  var today = new Date().getHours();
  updateCurrenciesAirtable();
  updatePerformanceAirtable();
}, the_interval);

// Fetch the rates from the Open Exchange API
function getPrice(currencyName, baseCurrency, callback) {
    request({
      uri: "https://min-api.cryptocompare.com/data/price?fsym="+currencyName+"&tsyms="+baseCurrency,
      method: "GET",
      timeout: 5000,
    }, function(error, resp, body) {
        
      var jsonObject = JSON.parse(body);
      callback(jsonObject[baseCurrency]);

    });
}

// Helper function for updating airtable rates
function updatePrice(newRate, id) {
    base('Currencies').update(id, {
      'Price': newRate
    }, function(err, record) {
      if (err) { console.log(err); return; }
      console.log(record);
    });

}

function getDate() {

    var today = new Date();
    var dd = today.getDate();
    var mm = today.getMonth();
    var yyyy = today.getFullYear();

    var monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

    return monthNames[mm]+' '+dd+' '+yyyy;
}

// Updates the perfomance tab in the airtable base
function updatePerfomance(fundValue) {
    base('Performance').create({
      'Date': getDate(),
      'Fund Value': fundValue,
    }, function(err, record) {
        if (err) { console.error(err); return; }
        console.log(record.getId());
    });
}

// Update Airtable with rates from Open Exchange
function updateCurrenciesAirtable() {

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

        getPrice(name, BASE_CURRENCY, function(rate){
          updatePrice(rate, id);
        });
        
      });

      fetchNextPage();
    }, function done(error) {
      if (error) {
          console.log(error);
      }
    });

}

function updatePerformanceAirtable(){

  base('Transactions').select({
      // Selecting the first 3 records in Main View:
      view: 'Crypto'
    }).eachPage(function page(records, fetchNextPage) {

      var funds = [];

      // Loop through each record and update the currency
      records.forEach(function updateRecords(record) {
        // Get the ID
        var id = record['_rawJson']['id'];
        // Get the name
        var fundValue = record.get('Current Value');

        funds.push(fundValue);

      });

      // sum the values
      var sum = funds.reduce((a, b) => a + b, 0);

      // update the perfomance tab
      updatePerfomance(sum);


      fetchNextPage();
    }, function done(error) {
      if (error) {
          console.log(error);
      }
    });

}

server.listen(PORT, function(error) {

    if (error) {
      console.error(error);
    } else {
      updateCurrenciesAirtable();
      updatePerformanceAirtable();
      console.info("==> 🌎  Listening on port %s. Visit http://localhost:%s/ in your browser.", PORT, PORT);
    }

});
