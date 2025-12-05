import { useLocation } from "wouter";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function CottagecoreDemo() {
  const [, setLocation] = useLocation();

  return (
    <div className="theme-demo-container" style={{
      fontFamily: "'Quicksand', 'Georgia', sans-serif",
      background: "linear-gradient(135deg, #f9f5ee 0%, #f5ece0 100%)",
      color: "#2d2418",
      minHeight: "100vh",
      padding: "2rem",
      overflow: "auto",
      backgroundImage: `
        repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(139, 101, 66, 0.02) 2px, rgba(139, 101, 66, 0.02) 4px),
        repeating-linear-gradient(90deg, transparent, transparent 2px, rgba(139, 101, 66, 0.02) 2px, rgba(139, 101, 66, 0.02) 4px)
      `
    }}>
      <div style={{ maxWidth: "1400px", margin: "0 auto" }}>
        <Button
          onClick={() => setLocation("/")}
          variant="outline"
          style={{
            background: "transparent",
            border: "2px solid #8b7355",
            color: "#5d4e37",
            marginBottom: "2rem",
            borderRadius: "1.5rem"
          }}
          data-testid="button-back"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Library
        </Button>

        <header style={{
          background: "linear-gradient(135deg, #f9f5ee 0%, #faf6ee 100%)",
          border: "2px solid rgba(139, 101, 66, 0.2)",
          borderRadius: "1.5rem",
          padding: "2rem",
          marginBottom: "2rem",
          boxShadow: "0 4px 12px rgba(139, 101, 66, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.5)"
        }}>
          <h1 style={{
            fontFamily: "'Vollkorn', 'Georgia', serif",
            fontSize: "3rem",
            fontWeight: 700,
            color: "#5d4e37",
            marginBottom: "0.5rem",
            letterSpacing: "1px"
          }}>
            Luma
          </h1>
          <p style={{
            fontSize: "1.1rem",
            color: "#8b7355",
            fontStyle: "italic",
            letterSpacing: "2px"
          }}>
            COTTAGECORE EDITION
          </p>
        </header>

        <div style={{
          display: "flex",
          gap: "1rem",
          margin: "2rem 0",
          padding: "1.5rem",
          background: "rgba(255, 255, 255, 0.5)",
          border: "2px solid rgba(139, 101, 66, 0.15)",
          borderRadius: "1.5rem"
        }}>
          {[
            { color: "linear-gradient(135deg, #f9f5ee 0%, #faf6ee 100%)", label: "Cream Linen" },
            { color: "linear-gradient(135deg, #5d4e37 0%, #6d5d45 100%)", label: "Warm Brown" },
            { color: "linear-gradient(135deg, #daa520 0%, #e6b840 100%)", label: "Honey Amber" },
            { color: "linear-gradient(135deg, #7ca982 0%, #8fbc94 100%)", label: "Sage Green" },
            { color: "#8b7355", label: "Soft Taupe" }
          ].map((item, idx) => (
            <div key={idx} style={{ flex: 1, textAlign: "center" as const }}>
              <div style={{
                width: "100%",
                height: "100px",
                borderRadius: "1rem",
                marginBottom: "0.5rem",
                border: "2px solid rgba(139, 101, 66, 0.2)",
                boxShadow: "0 2px 8px rgba(139, 101, 66, 0.15)",
                background: item.color
              }} />
              <div style={{ fontSize: "0.85rem", color: "#8b7355", fontWeight: 600 }}>{item.label}</div>
            </div>
          ))}
        </div>

        <h2 style={{
          fontFamily: "'Vollkorn', serif",
          fontSize: "1.8rem",
          color: "#5d4e37",
          margin: "2.5rem 0 1.5rem",
          fontWeight: 700,
          letterSpacing: "1px",
          display: "flex",
          alignItems: "center",
          gap: "0.5rem"
        }}>
          <span style={{ color: "#daa520", fontSize: "1.2rem" }}>❀</span>
          Sample Library
          <span style={{ color: "#daa520", fontSize: "1.2rem" }}>❀</span>
        </h2>

        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))",
          gap: "1.5rem",
          marginBottom: "2rem"
        }}>
          {[
            { icon: "🌿", title: "The Secret Garden", author: "Frances Hodgson Burnett", badges: ["CLASSIC", "NATURE"] },
            { icon: "🍃", title: "Anne of Green Gables", author: "L.M. Montgomery", badges: ["RURAL", "HEARTWARMING"] },
            { icon: "🌻", title: "Little Women", author: "Louisa May Alcott", badges: ["FAMILY", "COZY"] },
            { icon: "🌾", title: "A Year in Provence", author: "Peter Mayle", badges: ["MEMOIR", "PASTORAL"] }
          ].map((book, idx) => (
            <div key={idx} style={{
              background: "linear-gradient(135deg, #fefdfb 0%, #faf6ee 100%)",
              border: "2px solid rgba(139, 101, 66, 0.15)",
              borderRadius: "1.5rem",
              overflow: "hidden",
              boxShadow: "0 4px 12px rgba(139, 101, 66, 0.1)",
              transition: "all 0.3s"
            }}>
              <div style={{
                width: "100%",
                aspectRatio: "2/3",
                background: "linear-gradient(135deg, #f5ece0 0%, #f0e4d0 100%)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "4rem",
                borderBottom: "2px solid rgba(139, 101, 66, 0.1)",
                position: "relative" as const,
                overflow: "hidden"
              }}>
                {book.icon}
              </div>
              <div style={{ padding: "1.5rem" }}>
                <h3 style={{
                  fontFamily: "'Vollkorn', serif",
                  fontSize: "1.2rem",
                  fontWeight: 700,
                  color: "#5d4e37",
                  marginBottom: "0.5rem",
                  lineHeight: 1.4
                }}>
                  {book.title}
                </h3>
                <p style={{
                  fontSize: "0.95rem",
                  color: "#8b7355",
                  fontStyle: "italic",
                  marginBottom: "1rem"
                }}>
                  {book.author}
                </p>
                <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" as const }}>
                  {book.badges.map((badge, bidx) => (
                    <span key={bidx} style={{
                      padding: "0.4rem 0.8rem",
                      background: "rgba(218, 165, 32, 0.15)",
                      border: "1px solid rgba(218, 165, 32, 0.3)",
                      borderRadius: "1rem",
                      fontSize: "0.75rem",
                      color: "#8b6f14",
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
          background: "rgba(255, 255, 255, 0.6)",
          border: "2px solid rgba(139, 101, 66, 0.15)",
          borderRadius: "1.5rem",
          padding: "2rem",
          marginTop: "2.5rem"
        }}>
          <h3 style={{
            fontFamily: "'Vollkorn', serif",
            color: "#5d4e37",
            fontSize: "1.8rem",
            marginBottom: "1rem",
            letterSpacing: "1px"
          }}>
            Cottagecore Theme Characteristics
          </h3>
          <p style={{
            color: "#6d5d45",
            lineHeight: 1.8,
            marginBottom: "1rem"
          }}>
            Embrace the warmth of rural simplicity and nostalgic charm. This theme features soft, earthy tones inspired by cottage gardens, antique linens, and sun-dappled farmhouse kitchens. Perfect for creating a cozy, wholesome reading sanctuary.
          </p>
          
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: "1rem",
            marginTop: "1.5rem"
          }}>
            {[
              { icon: "🌼", label: "Soft & Rustic" },
              { icon: "🏡", label: "Warm Textures" },
              { icon: "🍯", label: "Honey Accents" },
              { icon: "☕", label: "Cozy & Inviting" }
            ].map((feature, idx) => (
              <div key={idx} style={{
                background: "rgba(218, 165, 32, 0.1)",
                border: "2px solid rgba(218, 165, 32, 0.2)",
                borderRadius: "1rem",
                padding: "1.2rem",
                textAlign: "center" as const
              }}>
                <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>{feature.icon}</div>
                <div style={{ fontSize: "0.9rem", color: "#5d4e37", fontWeight: 600 }}>{feature.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}