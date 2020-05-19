require('dotenv').config({ verbose: true });

const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const exphbs = require('express-handlebars');
const expressValidator = require('express-validator');
const mongo = require('mongodb');
const mongoose = require('mongoose');
const app = express();
const http = require('http').Server(app);
const request = require("request");
const io = require("socket.io")(http);

mongoose.Promise = global.Promise;
mongoose.connect(process.env.DB, { useMongoClient: true });
// mongoose.set('useCreateIndex', true);

mongoose.connection.once('open', (err) => {
  if (err) {
    console.log("Error connecting to database:" .err);
  } else {
    console.log("Successfully connected to db");
  }});

// database schema
var Stock = require("./models/stocks");

// Routes
const index = require("./routes/index");

// view engine
app.set("views", path.join(__dirname + "/views"));
app.engine("handlebars", exphbs({"defaultLayout": "layout"}));
app.set("view engine", "handlebars");

app.use(express.static(path.join(__dirname + "/public")));

io.on('connection', function(socket) {
	console.log("A user connected");

	var stockCodeList = [];

	// When a user makes the connection for the first time, send stock data
	// stored in database to client
	Stock.getAllStocks(function(err, stocks) {
		if (err) throw err;

		console.log(stocks);
		if (stocks != []) {

			for (let i in stocks) {
				stockCodeList.push(stocks[i].code);
				request({
					method: "GET",
					url: "https://www.alphavantage.co/query?" +
					"function=TIME_SERIES_MONTHLY&symbol=" + stocks[i].code +
					"&apikey=process.env.API_KEY"
					// The API key is retrieved from alphavantage.co
				}, function(error, response, body) {
					body = JSON.parse(body);
					body.sofar = stockCodeList;
					socket.emit('stock code', body);
				});
			}
		}
	});

	// user has entered a stock code
	socket.on('stock code', function(code) {
		console.log(code);
		request({
			method: "GET",
			url: "https://www.alphavantage.co/query?" +
				"function=TIME_SERIES_MONTHLY&symbol=" + code[0] +
				"&apikey=process.env.API_KEY"
		}, function(error, response, body) {
			body = JSON.parse(body);

			// if stock code is invalid, inform the user who entered it
			if (body["Error Message"]) {
				body.sofar = code[1];
				socket.emit('stock code', body);
			}
			// if stock code is valid, send to all users
			else {
				let index = stockCodeList.indexOf(code[0]);
				if (index == -1) {
					stockCodeList : code[0];
					body.sofar = code[1];
					io.emit('stock code', body);


					let newStock = new Stock({code: code[0]});
					Stock.addStock(newStock, (err, msg) => {
						if (err) throw err;
						console.log(msg);
					});
				}

			}

		});
	});

	// user has deleted a stock
	socket.on('deleteStock', (response) => {
		console.log("ID: ",response[0]);
		console.log("List: ", response[1]);

		stockCodeList = response[1];

		socket.broadcast.emit('removeStock', {code: response[0], list: stockCodeList});

		Stock.deleteStock(response[0], (err, msg) => {
			if (err) throw err;
			console.log(msg);
		});


	});

});

app.get("/", index);

app.use((req, res) => {
	res.render("404");
});

http.listen(3000, () => {
	console.log("Server running at port 3000");
});
