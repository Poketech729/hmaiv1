import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function HealthcareApp() {
  const [active, setActive] = useState("CareQueue");

  const projects = {
    CareQueue: {
      title: "CareQueue",
      desc: "AI-assisted hospital queue optimization to reduce wait times.",
    },
    MedAssist: {
      title: "MedAssist",
      desc: "Voice-driven medication assistant for elderly patients.",
    },
    Monitoring: {
      title: "Post-Operative Monitoring",
      desc: "Track recovery using wearable data and predictive alerts.",
    },
  };

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <h1 className="text-3xl font-bold text-center mb-6">
        Healthcare AI Dashboard
      </h1>

      {/* Navigation */}
      <div className="flex justify-center gap-4 mb-6">
        {Object.keys(projects).map((key) => (
          <Button key={key} onClick={() => setActive(key)}>
            {projects[key].title}
          </Button>
        ))}
      </div>

      {/* Main Card */}
      <Card className="max-w-2xl mx-auto">
        <CardContent className="p-6">
          <h2 className="text-xl font-semibold mb-2">
            {projects[active].title}
          </h2>
          <p className="mb-4">{projects[active].desc}</p>

          {/* Placeholder for data */}
          <div className="bg-white p-4 rounded shadow">
            <p className="text-gray-500">
              [ Connect backend API here for real-time data ]
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
