import express from "express";
import { deleteAllChunksController } from "../controllers/chunkController.js";

const chunkRoute = express.Router();

chunkRoute.delete("/delete-all-chunks", deleteAllChunksController);

export default chunkRoute;