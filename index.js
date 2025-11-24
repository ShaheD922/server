import express from "express";
import cors from "cors";
import { MongoClient, ObjectId } from "mongodb";
import serverless from "serverless-http";
import admin from "firebase-admin";
import dotenv from "dotenv";

dotenv.config();


const serviceAccount = JSON.parse(
  Buffer.from(process.env.FIREBASE_SERVICE_KEY, "base64").toString("utf8")
);

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const app = express();
app.use(cors());
app.use(express.json());
let client;
let db;
let issueCollection;
let contributionCollection;

async function connectDB() {
  if (!client) {
    client = new MongoClient(process.env.MONGO_URI);
    await client.connect();
    db = client.db("community-clean-db");
    issueCollection = db.collection("models");
    contributionCollection = db.collection("myContribution");
    console.log("MongoDB Connected Successfully (Vercel)");
  }
}
await connectDB();
app.get("/", (req, res) => {
  res.send("Server is running!");
});

app.get("/stats", async (req, res) => {
  const totalUsers = await contributionCollection.distinct("email");
  const resolvedCount = await issueCollection.countDocuments({ status: "ended" });
  const pendingCount = await issueCollection.countDocuments({ status: "ongoing" });

  res.send({
    users: totalUsers.length,
    resolved: resolvedCount,
    pending: pendingCount,
  });
});

app.get("/models", async (req, res) => {
  const issues = await issueCollection.find().sort({ date: -1 }).toArray();
  res.send(issues);
});

app.get("/models/:id", async (req, res) => {
  const id = req.params.id;
  const issue = await issueCollection.findOne({ _id: new ObjectId(id) });
  res.send(issue);
});

app.post("/models", async (req, res) => {
  const issue = req.body;
  issue.date = new Date();
  issue.status = issue.status || "ongoing";
  const result = await issueCollection.insertOne(issue);
  res.send(result);
});

app.put("/models/:id", async (req, res) => {
  const id = req.params.id;
  const updatedData = req.body;
  const result = await issueCollection.updateOne(
    { _id: new ObjectId(id) },
    { $set: updatedData }
  );
  res.send(result);
});

app.delete("/models/:id", async (req, res) => {
  const id = req.params.id;
  const result = await issueCollection.deleteOne({ _id: new ObjectId(id) });
  res.send(result);
});

app.post("/mycontribution", async (req, res) => {
  const contribution = req.body;
  contribution.date = new Date();
  const result = await contributionCollection.insertOne(contribution);
  res.send(result);
});

app.get("/mycontribution/:issueId", async (req, res) => {
  const issueId = req.params.issueId;
  const contributions = await contributionCollection.find({ issueId }).toArray();
  res.send(contributions);
});

app.get("/mycontribution", async (req, res) => {
  const email = req.query.email;
  const contributions = await contributionCollection
    .find({ email })
    .sort({ date: -1 })
    .toArray();
  res.send(contributions);
});

app.get("/myissues", async (req, res) => {
  const email = req.query.email;
  const issues = await issueCollection
    .find({ email })
    .sort({ date: -1 })
    .toArray();
  res.send(issues);
});

export default serverless(app);
