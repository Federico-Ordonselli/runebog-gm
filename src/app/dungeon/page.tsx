import DungeonGenerator from "./generator";
import "./dungeon.css";

export const metadata = {
  title: "Generatore di Dungeon — Runebog GM",
  description:
    "Dungeon D&D 5e riproducibili da seed: mappa a griglia, incontri bilanciati (regole 2014/2024), bottino e trappole. Dati SRD 5.1.",
};

export default function DungeonPage() {
  return (
    <main className="page dg-page">
      <div className="bar">
        <h1 className="title title--sm">
          Generatore di Dungeon
          <span className="title__kicker">Griglia D&D 5e · 1 quadrato = 5 ft = 1,5 m · dati SRD (OGL/CC-BY)</span>
        </h1>
        <p className="muted small"><a href="/" className="link link--quiet">← Runebog GM</a></p>
      </div>
      <DungeonGenerator />
    </main>
  );
}
