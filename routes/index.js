const express = require("express");
const router = express.Router();
const Stock = require("../models/stocks");
const http = require("http").Server(express());
const io = require("socket.io")(http);

router.get("/", (req, res) => {
	res.render("index");
});



module.exports = router;
