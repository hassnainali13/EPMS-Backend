import dotenv from "dotenv";

dotenv.config();

async function run() {
  try {
    const loginRes = await fetch("http://localhost:5000/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "admin@epms.io",
        password: "Admin@EPMS2024",
      }),
    });
    const loginData = await loginRes.json();
    console.log("Login response:", loginData);
    const token = loginData.token;
    if (!token) return console.error("No token from login");

    const payload = {
      panelName: "Test Panel From Node",
      panelType: "MCC",
      customer: "Node test",
    };

    const createRes = await fetch("http://localhost:5000/api/panels", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });
    const createData = await createRes.json();
    console.log("Create response status:", createRes.status);
    console.log("Create response body:", createData);
  } catch (err) {
    console.error("Test failed:", err);
  }
}

run();
