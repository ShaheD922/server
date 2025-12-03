import express from "express";
import cors from "cors";
import { MongoClient, ObjectId, ServerApiVersion } from "mongodb";
import admin from "firebase-admin";
import serverless from "serverless-http";
import dotenv from "dotenv";
dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

if (!admin.apps.length) {
  try {
    const firebaseKey = JSON.parse(
      Buffer.from(process.env.FIREBASE_SERVICE_KEY, "base64").toString("utf8")
    );
    admin.initializeApp({
      credential: admin.credential.cert(firebaseKey),
    });
  } catch (err) {
    console.error("Firebase init error:", err);
  }
}

let cachedClient = null;
let cachedDb = null;

async function connectToDatabase() {
  if (cachedClient && cachedDb) return { db: cachedDb };
  const client = new MongoClient(process.env.MONGO_URI, {
    serverApi: { version: ServerApiVersion.v1, strict: false },
  });
  const db = client.db("community-clean-db");
  cachedClient = client;
  cachedDb = db;
  return { db };
}

const verifyToken = async (req, res, next) => {
  const authorization = req.headers.authorization;
  if (!authorization) return res.status(401).json({ message: "Missing token" });
  const token = authorization.split(" ")[1];
  try {
    const decoded = await admin.auth().verifyIdToken(token);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ message: "Invalid token" });
  }
};

app.get("/", (req, res) => res.send("Server is running fine!"));


app.get("/models", async (req, res) => {
  try {
    const { db } = await connectToDatabase();
    const issues = await db.collection("models").find().sort({ date: -1 }).toArray();
    res.json(issues);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server Error" });
  }
});

app.get("/models/:id", async (req, res) => {
  try {
    const { db } = await connectToDatabase();
    const issue = await db.collection("models").findOne({ _id: new ObjectId(req.params.id) });
    if (!issue) return res.status(404).json({ error: "Issue not found" });
    res.json(issue);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server Error" });
  }
});

app.post("/models", verifyToken, async (req, res) => {
  try {
    const { db } = await connectToDatabase();
    const issue = { ...req.body, email: req.user.email, date: new Date(), status: req.body.status || "ongoing" };
    const result = await db.collection("models").insertOne(issue);
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server Error" });
  }
});

app.put("/models/:id", verifyToken, async (req, res) => {
  try {
    const { db } = await connectToDatabase();
    const result = await db.collection("models").updateOne(
      { _id: new ObjectId(req.params.id), email: req.user.email },
      { $set: req.body }
    );
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server Error" });
  }
});

app.delete("/models/:id", verifyToken, async (req, res) => {
  try {
    const { db } = await connectToDatabase();
    const result = await db.collection("models").deleteOne({ _id: new ObjectId(req.params.id), email: req.user.email });
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server Error" });
  }
});

app.get("/myissues", verifyToken, async (req, res) => {
  try {
    const { db } = await connectToDatabase();
    const email = req.query.email || req.user.email;
    const issues = await db.collection("models").find({ email }).sort({ date: -1 }).toArray();
    res.json(issues);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server Error" });
  }
});


app.post("/mycontribution", verifyToken, async (req, res) => {
  try {
    const { db } = await connectToDatabase();
    const doc = { ...req.body, email: req.user.email, date: new Date() };
    const result = await db.collection("myContribution").insertOne(doc);
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server Error" });
  }
});

app.get("/mycontribution", verifyToken, async (req, res) => {
  try {
    const { db } = await connectToDatabase();
    const email = req.query.email || req.user.email;
    const contributions = await db.collection("myContribution").find({ email }).sort({ date: -1 }).toArray();
    res.json(contributions);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server Error" });
  }
});

app.get("/mycontribution/:issueId", async (req, res) => {
  try {
    const { db } = await connectToDatabase();
    const contributions = await db.collection("myContribution").find({ issueId: req.params.issueId }).toArray();
    res.json(contributions);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server Error" });
  }
});

export const handler = serverless(app);
export default app;
