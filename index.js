const express = require("express");
const cors = require("cors");
const { MongoClient, ObjectId } = require("mongodb");
require("dotenv").config();

const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const client = new MongoClient(process.env.MONGO_URI);

async function run() {
  try {
    await client.connect();
    const db = client.db("community-clean-db");
    const issueCollection = db.collection("models");
    const contributionCollection = db.collection("myContribution");

    console.log("MongoDB connected!");


    app.get("/stats", async (req, res) => {
      try {
        const totalUsers = await contributionCollection.distinct("email");
        const resolvedCount = await issueCollection.countDocuments({ status: "ended" });
        const pendingCount = await issueCollection.countDocuments({ status: "ongoing" });

        res.send({
          users: totalUsers.length,
          resolved: resolvedCount,
          pending: pendingCount,
        });
      } catch (error) {
        console.error(error);
        res.status(500).send({ error: "Failed to fetch stats" });
      }
    });

   
    app.get("/models", async (req, res) => {
      const issues = await issueCollection.find().sort({ date: -1 }).toArray();
      res.send(issues);
    });

    // Single issue
    app.get("/models/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const issue = await issueCollection.findOne({ _id: new ObjectId(id) });
        if (!issue) return res.status(404).send({ error: "Issue not found" });
        res.send(issue);
      } catch (error) {
        console.error(error);
        res.status(500).send({ error: "Internal server error" });
      }
    });

    // Add new issue
    app.post("/models", async (req, res) => {
      const issue = req.body;
      issue.date = new Date();
      issue.status = issue.status || "ongoing";

      const result = await issueCollection.insertOne(issue);
      res.send(result);
    });

    // Update issue
    app.put("/models/:id", async (req, res) => {
      const id = req.params.id;
      const updatedData = req.body;
      try {
        const result = await issueCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: updatedData }
        );
        res.send(result);
      } catch (error) {
        console.error(error);
        res.status(500).send({ error: "Failed to update issue" });
      }
    });

    // Delete issue
    app.delete("/models/:id", async (req, res) => {
      const id = req.params.id;
      try {
        const result = await issueCollection.deleteOne({ _id: new ObjectId(id) });
        res.send(result);
      } catch (error) {
        console.error(error);
        res.status(500).send({ error: "Failed to delete issue" });
      }
    });

    app.post("/mycontribution", async (req, res) => {
      const contribution = req.body;
      if (!contribution.email) return res.status(400).send({ error: "Email required" });

      contribution.issueId = contribution.issueId.toString();
      contribution.date = new Date();

      contribution.name = contribution.contributorName || "Anonymous";

      
      contribution.image = contribution.image || "";

      try {
        const result = await contributionCollection.insertOne(contribution);
        res.send(result);
      } catch (error) {
        console.error(error);
        res.status(500).send({ error: "Failed to add contribution" });
      }
    });

    app.get("/mycontribution/:issueId", async (req, res) => {
      const issueId = req.params.issueId;
      const contributions = await contributionCollection.find({ issueId }).toArray();
      res.send(contributions);
    });

    app.get("/mycontribution", async (req, res) => {
      const email = req.query.email;
      if (!email) return res.status(400).send({ error: "Email query missing" });

      try {
        const contributions = await contributionCollection
          .find({ email: email.toLowerCase() })
          .sort({ date: -1 })
          .toArray();
        res.send(contributions);
      } catch (error) {
        console.error(error);
        res.status(500).send({ error: "Failed to fetch contributions" });
      }
    });


    app.get("/myissues", async (req, res) => {
      const email = req.query.email;
      if (!email) return res.status(400).send({ error: "Email query missing" });

      try {
        const issues = await issueCollection
          .find({ email: email.toLowerCase() })
          .sort({ date: -1 })
          .toArray();
        res.send(issues);
      } catch (error) {
        console.error(error);
        res.status(500).send({ error: "Failed to fetch user issues" });
      }
    });

  } catch (error) {
    console.error(error); 
  }
}

run();

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
//