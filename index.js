import express from "express";
import cors from "cors";
import { MongoClient, ObjectId, ServerApiVersion } from "mongodb";
import admin from "firebase-admin";
import serverless from "serverless-http";

const app = express();
app.use(cors());
app.use(express.json());

if (!admin.apps.length) {
  try {
    const firebaseKey = JSON.parse(
      Buffer.from(process.env.FIREBASE_SERVICE_KEY, "base64").toString("utf8")
    );
    admin.initializeApp({ credential: admin.credential.cert(firebaseKey) });
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
  await client.connect();
  const db = client.db("community-clean-db");

  cachedClient = client;
  cachedDb = db;
  return { db };
}


const verifyToken = async (req, res, next) => {
  const authorization = req.headers.authorization;
  if (!authorization) return res.status(401).send({ message: "Missing token" });

  const token = authorization.split(" ")[1];
  try {
    await admin.auth().verifyIdToken(token);
    next();
  } catch (err) {
    return res.status(401).send({ message: "Invalid token" });
  }
};


app.get("/", (req, res) => res.send("Server is running fine!"));


app.get("/models", async (req, res) => {
  try {
    const { db } = await connectToDatabase();
    const models = await db.collection("models").find().sort({ date: -1 }).toArray();
    res.json(models);
  } catch {
    res.status(500).json({ error: "Server Error" });
  }
});

app.get("/models/:id", async (req, res) => {
  try {
    const { db } = await connectToDatabase();
    const model = await db.collection("models").findOne({ _id: new ObjectId(req.params.id) });
    res.json(model);
  } catch {
    res.status(500).json({ error: "Server Error" });
  }
});

app.post("/models", async (req, res) => {
  try {
    const { db } = await connectToDatabase();
    const doc = { ...req.body, date: new Date(), status: req.body.status || "ongoing" };
    const result = await db.collection("models").insertOne(doc);
    res.json(result);
  } catch {
    res.status(500).json({ error: "Server Error" });
  }
});

app.put("/models/:id", async (req, res) => {
  try {
    const { db } = await connectToDatabase();
    const result = await db
      .collection("models")
      .updateOne({ _id: new ObjectId(req.params.id) }, { $set: req.body });
    res.json(result);
  } catch {
    res.status(500).json({ error: "Server Error" });
  }
});

app.delete("/models/:id", async (req, res) => {
  try {
    const { db } = await connectToDatabase();
    const result = await db.collection("models").deleteOne({ _id: new ObjectId(req.params.id) });
    res.json(result);
  } catch {
    res.status(500).json({ error: "Server Error" });
  }
});


app.post("/mycontribution", verifyToken, async (req, res) => {
  try {
    const { db } = await connectToDatabase();
    const doc = { ...req.body, date: new Date() };
    const result = await db.collection("myContribution").insertOne(doc);
    res.json(result);
  } catch {
    res.status(500).json({ error: "Server Error" });
  }
});

app.get("/mycontribution", verifyToken, async (req, res) => {
  try {
    const { db } = await connectToDatabase();
    const email = req.query.email;
    const contributions = await db
      .collection("myContribution")
      .find({ email })
      .sort({ date: -1 })
      .toArray();
    res.json(contributions);
  } catch {
    res.status(500).json({ error: "Server Error" });
  }
});

app.get("/mycontribution/:id", verifyToken, async (req, res) => {
  try {
    const { db } = await connectToDatabase();
    const contribution = await db
      .collection("myContribution")
      .findOne({ _id: new ObjectId(req.params.id) });
    res.json(contribution);
  } catch {
    res.status(500).json({ error: "Server Error" });
  }
});


export const handler = serverless(app);
export default app;
