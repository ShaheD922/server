
const express = require("express");
const cors = require("cors");
const { MongoClient, ObjectId } = require("mongodb");
require("dotenv").config();


const admin = require("firebase-admin");

const serviceAccount = JSON.parse(
  Buffer.from(process.env.FIREBASE_SERVICE_KEY, "base64").toString("utf8")
);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});


const app = express();
app.use(cors());
app.use(express.json());

const client = new MongoClient(process.env.MONGO_URI);

async function run() {
  try {
    await client.connect();
    const db = client.db("community-clean-db");
    const issueCollection = db.collection("models");
    const contributionCollection = db.collection("myContribution");


    
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

    console.log("Server routes initialized ✅");
  } catch (error) {
    console.error("Error connecting to MongoDB or setting up routes:", error);
  }
}

run();

app.listen(process.env.PORT || 5000, () => {
  console.log(`Server running on port ${process.env.PORT || 5000}`);
});

module.exports = app;
//