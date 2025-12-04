import { useLocation } from "wouter";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function BaroqueDemo() {
  const [, setLocation] = useLocation();

  return (
    <div className="theme-demo-container" style={{
      fontFamily: "'Playfair Display', 'Georgia', serif",
      background: "linear-gradient(135deg, #1a0a0f 0%, #2d1219 50%, #1a0a0f 100%)",
      color: "#f4e8d8",
      minHeight: "100vh",
      padding: "2rem",
      overflow: "auto"
    }}>
      <div style={{ maxWidth: "1400px", margin: "0 auto" }}>
        <Button
          onClick={() => setLocation("/")}
          variant="outline"
          style={{
            background: "transparent",
            border: "2px solid #d4af37",
            color: "#d4af37",
            marginBottom: "2rem",
            borderRadius: "6px"
          }}
          data-testid="button-back"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Library
        </Button>

        <header style={{
          background: "linear-gradient(135deg, #3d1a25 0%, #2d0f1a 100%)",
          border: "2px solid #8b6914",
          borderRadius: "8px",
          padding: "2rem",
          marginBottom: "3rem",
          boxShadow: "0 10px 40px rgba(0, 0, 0, 0.8), inset 0 1px 0 rgba(255, 215, 0, 0.2)",
          position: "relative" as const,
          overflow: "hidden"
        }}>
          <h1 style={{
            fontSize: "3.5rem",
            fontWeight: 900,
            background: "linear-gradient(135deg, #FFD700 0%, #FFA500 50%, #FFD700 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
            letterSpacing: "2px",
            marginBottom: "0.5rem"
          }}>
            Luma
          </h1>
          <p style={{
            fontSize: "1.2rem",
            color: "#d4af37",
            fontStyle: "italic",
            letterSpacing: "3px"
          }}>
            BAROQUE EDITION
          </p>
        </header>

        <div style={{
          display: "flex",
          gap: "1rem",
          margin: "2rem 0",
          padding: "2rem",
          background: "rgba(0, 0, 0, 0.4)",
          border: "1px solid #8b6914",
          borderRadius: "8px"
        }}>
          {[
            { color: "linear-gradient(135deg, #1a0a0f 0%, #2d1219 50%, #1a0a0f 100%)", label: "Deep Background" },
            { color: "linear-gradient(135deg, #6b1529 0%, #8b1e3f 100%)", label: "Burgundy Accent" },
            { color: "linear-gradient(135deg, #8b6914 0%, #d4af37 100%)", label: "Gold Leaf" },
            { color: "#FFD700", label: "Pure Gold" },
            { color: "#f4e8d8", label: "Parchment Text" }
          ].map((item, idx) => (
            <div key={idx} style={{ flex: 1, textAlign: "center" as const }}>
              <div style={{
                width: "100%",
                height: "100px",
                borderRadius: "6px",
                marginBottom: "0.5rem",
                border: "2px solid #8b6914",
                boxShadow: "0 4px 15px rgba(0, 0, 0, 0.6)",
                background: item.color
              }} />
              <div style={{ fontSize: "0.85rem", color: "#d4af37" }}>{item.label}</div>
            </div>
          ))}
        </div>

        <h2 style={{
          fontSize: "2rem",
          color: "#FFD700",
          margin: "3rem 0 1.5rem",
          fontWeight: 700,
          letterSpacing: "2px",
          textTransform: "uppercase" as const,
          borderBottom: "2px solid #8b6914",
          paddingBottom: "0.5rem",
          textShadow: "0 2px 10px rgba(255, 215, 0, 0.3)"
        }}>
          ✦ Sample Library ✦
        </h2>

        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))",
          gap: "2rem",
          marginBottom: "3rem"
        }}>
          {[
            { icon: "📖", title: "The Divine Comedy", author: "Dante Alighieri", badges: ["CLASSIC", "EPIC"] },
            { icon: "📕", title: "Paradise Lost", author: "John Milton", badges: ["POETRY", "17TH CENTURY"] },
            { icon: "📗", title: "Les Misérables", author: "Victor Hugo", badges: ["DRAMA", "HISTORICAL"] },
            { icon: "📘", title: "Don Quixote", author: "Miguel de Cervantes", badges: ["ADVENTURE", "SATIRE"] }
          ].map((book, idx) => (
            <div key={idx} style={{
              background: "linear-gradient(135deg, #2d0f1a 0%, #1a0a0f 100%)",
              border: "2px solid #8b6914",
              borderRadius: "8px",
              overflow: "hidden",
              boxShadow: "0 10px 30px rgba(0, 0, 0, 0.7), inset 0 1px 0 rgba(255, 215, 0, 0.1)",
              transition: "all 0.4s"
            }}>
              <div style={{
                width: "100%",
                aspectRatio: "2/3",
                background: "linear-gradient(135deg, #4a1e2e 0%, #2d1219 100%)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "4rem",
                color: "#d4af37",
                borderBottom: "2px solid #8b6914"
              }}>
                {book.icon}
              </div>
              <div style={{ padding: "1.5rem" }}>
                <h3 style={{
                  fontSize: "1.3rem",
                  fontWeight: 700,
                  color: "#FFD700",
                  marginBottom: "0.5rem",
                  lineHeight: 1.4
                }}>
                  {book.title}
                </h3>
                <p style={{
                  fontSize: "1rem",
                  color: "#c4b098",
                  fontStyle: "italic",
                  marginBottom: "1rem"
                }}>
                  {book.author}
                </p>
                <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" as const }}>
                  {book.badges.map((badge, bidx) => (
                    <span key={bidx} style={{
                      padding: "0.4rem 0.8rem",
                      background: "rgba(139, 105, 20, 0.3)",
                      border: "1px solid #8b6914",
                      borderRadius: "4px",
                      fontSize: "0.75rem",
                      color: "#d4af37",
                      fontWeight: 600,
                      letterSpacing: "0.5px"
                    }}>
                      {badge}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div style={{
          background: "rgba(0, 0, 0, 0.5)",
          border: "2px solid #8b6914",
          borderRadius: "8px",
          padding: "2rem",
          marginTop: "3rem"
        }}>
          <h3 style={{
            color: "#FFD700",
            fontSize: "1.8rem",
            marginBottom: "1rem",
            letterSpacing: "1px"
          }}>
            Baroque Theme Characteristics
          </h3>
          <p style={{
            color: "#c4b098",
            lineHeight: 1.8,
            marginBottom: "1rem"
          }}>
            Experience the grandeur and opulence of 17th-century European design. This theme features dramatic contrasts, ornate gold accents, and deep, rich colors that evoke the majesty of baroque palaces and cathedrals.
          </p>
          
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: "1rem",
            marginTop: "1.5rem"
          }}>
            {[
              { icon: "👑", label: "Regal & Ornate" },
              { icon: "✨", label: "Gold Leaf Accents" },
              { icon: "🎭", label: "Dramatic Shadows" },
              { icon: "🏛️", label: "High Contrast" }
            ].map((feature, idx) => (
              <div key={idx} style={{
                background: "rgba(139, 105, 20, 0.2)",
                border: "1px solid #8b6914",
                borderRadius: "6px",
                padding: "1rem",
                textAlign: "center" as const
              }}>
                <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>{feature.icon}</div>
                <div style={{ fontSize: "0.9rem", color: "#d4af37", fontWeight: 600 }}>{feature.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}