import express from "express";
import cors from "cors";
import { MongoClient, ObjectId } from "mongodb";
import serverless from "serverless-http";
import admin from "firebase-admin";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Firebase 



if (!admin.apps.length) {
  const serviceAccount = JSON.parse(
    Buffer.from(process.env.FIREBASE_SERVICE_KEY, "base64").toString("utf8")
  );
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}


let cachedClient = null;
let cachedDb = null;

async function connectToDatabase() {
  if (cachedClient && cachedDb) return { client: cachedClient, db: cachedDb };

  const client = new MongoClient(process.env.MONGO_URI, {
    serverApi: { version: "1" },
    connectTimeoutMS: 10000,
  });

  await client.connect(); 
  const db = client.db("community-clean-db");

  cachedClient = client;
  cachedDb = db;

  return { client, db };
}

// Routes
app.get("/", (req, res) => res.send("Server is running!"));


app.get("/stats", async (req, res) => {
  try {
    const { db } = await connectToDatabase();
    const contributionCollection = db.collection("myContribution");
    const issueCollection = db.collection("models");

    const totalUsers = await contributionCollection.distinct("email");
    const resolvedCount = await issueCollection.countDocuments({ status: "ended" });
    const pendingCount = await issueCollection.countDocuments({ status: "ongoing" });

    res.json({ users: totalUsers.length, resolved: resolvedCount, pending: pendingCount });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Models
app.get("/models", async (req, res) => {
  try {
    const { db } = await connectToDatabase();
    const issues = await db.collection("models").find().sort({ date: -1 }).toArray();
    res.json(issues);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
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
    res.status(500).json({ error: "Internal server error" });
  }
});

app.post("/models", async (req, res) => {
  try {
    const { db } = await connectToDatabase();
    const issue = { ...req.body, date: new Date(), status: req.body.status || "ongoing" };
    const result = await db.collection("models").insertOne(issue);
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.put("/models/:id", async (req, res) => {
  try {
    const { db } = await connectToDatabase();
    const result = await db.collection("models").updateOne(
      { _id: new ObjectId(req.params.id) },
      { $set: req.body }
    );
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.delete("/models/:id", async (req, res) => {
  try {
    const { db } = await connectToDatabase();
    const result = await db.collection("models").deleteOne({ _id: new ObjectId(req.params.id) });
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Contributions 
app.post("/mycontribution", async (req, res) => {
  try {
    const { db } = await connectToDatabase();
    const contribution = { ...req.body, date: new Date() };
    const result = await db.collection("myContribution").insertOne(contribution);
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.get("/mycontribution/:issueId", async (req, res) => {
  try {
    const { db } = await connectToDatabase();
    const contributions = await db.collection("myContribution")
      .find({ issueId: req.params.issueId })
      .toArray();
    res.json(contributions);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.get("/mycontribution", async (req, res) => {
  try {
    const { db } = await connectToDatabase();
    const email = req.query.email;
    if (!email) return res.status(400).json({ error: "Email query missing" });
    const contributions = await db.collection("myContribution")
      .find({ email })
      .sort({ date: -1 })
      .toArray();
    res.json(contributions);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.get("/myissues", async (req, res) => {
  try {
    const { db } = await connectToDatabase();
    const email = req.query.email;
    if (!email) return res.status(400).json({ error: "Email query missing" });
    const issues = await db.collection("models")
      .find({ email })
      .sort({ date: -1 })
      .toArray();
    res.json(issues);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});


export const handler = serverless(app);


if (process.env.NODE_ENV !== "production") {
  const port = process.env.PORT || 5000;
  app.listen(port, () => console.log(`Server running locally on http://localhost:${port}`));
}
