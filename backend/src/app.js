import express from "express";
import mongoose from "mongoose";
import cors from "cors";

import { createServer } from "node:http";
import { Server } from "socket.io";
import { connectToSocket } from "./controllers/socketManager.js";
import userRoutes from "./routes/users.routes.js";

const app = express();
const server = createServer(app);
const io = connectToSocket(server);

app.set("port", process.env.PORT || 8000);

app.use(cors());
app.use(express.json({ limit: "40kb" }));
app.use(express.urlencoded({ limit: "40kb", extended: true }));

app.get("/home", (req, res) => {
    return res.json({ "hello": "world" });
});

app.use("/api/v1/user", userRoutes);

const start = async () => {

    const connectionDB = await mongoose.connect("mongodb+srv://prakash07dz:efJD9fwnFt7awEyT@cluster0.0oa74.mongodb.net/");

    console.log(`MONGO CONNECTED DB HOST : ${connectionDB.connection.host}`);

    server.listen(app.get("port"), () => {
        console.log("SERVER IS LISTNING ON PORT 8000");
    });
}

start();