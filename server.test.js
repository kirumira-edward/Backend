// server.test.js
const request = require("supertest");
const mongoose = require("mongoose");
const { app, connectDB } = require("./server");

beforeAll(async () => {
  await connectDB();
  await mongoose.connection.db.dropDatabase(); // Clear database before tests
});

afterAll(async () => {
  await mongoose.connection.close();
});

describe("Test the endpoints", () => {
  test("POST /api/register - register a new farmer", async () => {
    const res = await request(app).post("/api/register").send({
      firstName: "John",
      lastName: "Doe",
      email: "johndoe@example.com",
      password: "password123",
    });

    // Check for successful registration
    expect(res.statusCode).toBe(201);
    expect(res.body).toHaveProperty("message", "Farmer registered successfully.");
  });
});
