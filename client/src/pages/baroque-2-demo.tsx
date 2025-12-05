import { useLocation } from "wouter";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Baroque2Demo() {
  const [, setLocation] = useLocation();

  return (
    <div className="theme-demo-container" style={{
      fontFamily: "'Playfair Display', 'Georgia', serif",
      background: "#0a0604",
      color: "#e8dcc8",
      minHeight: "100vh",
      padding: "2rem",
      overflow: "auto",
      backgroundImage: "radial-gradient(circle at 20% 50%, rgba(139, 105, 20, 0.05) 0%, transparent 50%), radial-gradient(circle at 80% 80%, rgba(139, 69, 19, 0.05) 0%, transparent 50%)"
    }}>
      <div style={{ maxWidth: "1400px", margin: "0 auto" }}>
        <Button
          onClick={() => setLocation("/")}
          variant="outline"
          style={{
            background: "rgba(212, 175, 55, 0.1)",
            border: "2px solid #8b6914",
            color: "#d4af37",
            marginBottom: "2rem",
            borderRadius: "4px"
          }}
          data-testid="button-back"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Library
        </Button>

        {/* Ornate Header with Scrollwork */}
        <header style={{
          background: "linear-gradient(135deg, #1a1410 0%, #0f0a08 100%)",
          border: "3px solid #8b6914",
          borderRadius: "4px",
          padding: "3rem 2rem",
          marginBottom: "3rem",
          boxShadow: "0 15px 50px rgba(0, 0, 0, 0.9), inset 0 1px 0 rgba(212, 175, 55, 0.3)",
          position: "relative" as const,
          overflow: "hidden"
        }}>
          {/* Ornate corner decorations */}
          <div style={{
            position: "absolute" as const,
            top: "1rem",
            left: "1rem",
            fontSize: "3rem",
            color: "#8b6914",
            opacity: 0.6
          }}>╔</div>
          <div style={{
            position: "absolute" as const,
            top: "1rem",
            right: "1rem",
            fontSize: "3rem",
            color: "#8b6914",
            opacity: 0.6
          }}>╗</div>
          <div style={{
            position: "absolute" as const,
            bottom: "1rem",
            left: "1rem",
            fontSize: "3rem",
            color: "#8b6914",
            opacity: 0.6
          }}>╚</div>
          <div style={{
            position: "absolute" as const,
            bottom: "1rem",
            right: "1rem",
            fontSize: "3rem",
            color: "#8b6914",
            opacity: 0.6
          }}>╝</div>

          <div style={{
            textAlign: "center" as const,
            position: "relative" as const,
            zIndex: 1
          }}>
            <div style={{
              fontSize: "1rem",
              letterSpacing: "0.3em",
              color: "#8b6914",
              marginBottom: "1rem",
              fontWeight: 300
            }}>⟡ PRESENTING ⟡</div>
            
            <h1 style={{
              fontSize: "4.5rem",
              fontWeight: 900,
              background: "linear-gradient(135deg, #d4af37 0%, #FFD700 30%, #FFA500 50%, #FFD700 70%, #d4af37 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
              letterSpacing: "0.1em",
              marginBottom: "1rem",
              textTransform: "uppercase" as const,
              filter: "drop-shadow(0 4px 20px rgba(255, 215, 0, 0.4))"
            }}>
              Luma
            </h1>
            
            <div style={{
              fontSize: "1.3rem",
              color: "#c9a961",
              fontStyle: "italic",
              letterSpacing: "0.2em"
            }}>
              ~ Baroque Edition Refined ~
            </div>
            
            <div style={{
              marginTop: "1.5rem",
              fontSize: "2rem",
              color: "#8b6914"
            }}>❖ ❖ ❖</div>
          </div>
        </header>

        {/* Color Palette */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(5, 1fr)",
          gap: "1.5rem",
          margin: "2rem 0",
          padding: "2rem",
          background: "rgba(26, 20, 16, 0.6)",
          border: "2px solid #8b6914",
          borderRadius: "4px"
        }}>
          {[
            { color: "#0a0604", label: "Deep Charcoal", accent: "Background" },
            { color: "linear-gradient(135deg, #1a1410 0%, #2d1f1a 100%)", label: "Rich Brown", accent: "Surface" },
            { color: "linear-gradient(135deg, #8b6914 0%, #d4af37 100%)", label: "Antique Gold", accent: "Primary" },
            { color: "#FFD700", label: "Pure Gold", accent: "Accent" },
            { color: "#e8dcc8", label: "Aged Parchment", accent: "Text" }
          ].map((item, idx) => (
            <div key={idx} style={{ textAlign: "center" as const }}>
              <div style={{
                width: "100%",
                height: "120px",
                borderRadius: "4px",
                marginBottom: "0.75rem",
                border: "3px solid #8b6914",
                boxShadow: "0 6px 20px rgba(0, 0, 0, 0.8), inset 0 2px 10px rgba(212, 175, 55, 0.2)",
                background: item.color
              }} />
              <div style={{ fontSize: "0.95rem", color: "#d4af37", fontWeight: 700, marginBottom: "0.25rem" }}>{item.label}</div>
              <div style={{ fontSize: "0.75rem", color: "#8b7355", fontStyle: "italic" }}>{item.accent}</div>
            </div>
          ))}
        </div>

        {/* Sample Library with Ornate Borders */}
        <h2 style={{
          fontSize: "2.5rem",
          color: "#FFD700",
          margin: "3rem 0 2rem",
          fontWeight: 900,
          letterSpacing: "0.15em",
          textTransform: "uppercase" as const,
          textAlign: "center" as const,
          borderTop: "2px solid #8b6914",
          borderBottom: "2px solid #8b6914",
          padding: "1.5rem 0",
          textShadow: "0 3px 15px rgba(255, 215, 0, 0.4)"
        }}>
          ⟐ Distinguished Collection ⟐
        </h2>

        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
          gap: "2.5rem",
          marginBottom: "3rem"
        }}>
          {[
            { title: "Divine Comedy", author: "Dante Alighieri", year: "1320", category: "EPIC POETRY" },
            { title: "Paradise Lost", author: "John Milton", year: "1667", category: "CLASSICAL" },
            { title: "Les Misérables", author: "Victor Hugo", year: "1862", category: "LITERATURE" },
            { title: "Don Quixote", author: "Miguel de Cervantes", year: "1605", category: "ADVENTURE" }
          ].map((book, idx) => (
            <div key={idx} style={{
              background: "linear-gradient(135deg, #1a1410 0%, #0f0a08 100%)",
              border: "3px solid #8b6914",
              borderRadius: "4px",
              overflow: "hidden",
              boxShadow: "0 12px 35px rgba(0, 0, 0, 0.8), inset 0 1px 0 rgba(212, 175, 55, 0.2)",
              transition: "all 0.4s",
              position: "relative" as const
            }}>
              {/* Ornate top border */}
              <div style={{
                height: "3px",
                background: "linear-gradient(90deg, transparent, #FFD700, transparent)"
              }} />
              
              <div style={{
                width: "100%",
                aspectRatio: "2/3",
                background: "linear-gradient(135deg, #2d1f1a 0%, #1a1410 100%)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                borderBottom: "3px solid #8b6914",
                position: "relative" as const,
                overflow: "hidden"
              }}>
                {/* Ornamental corner pieces */}
                <div style={{
                  position: "absolute" as const,
                  top: "1rem",
                  left: "1rem",
                  fontSize: "1.5rem",
                  color: "#8b6914"
                }}>❈</div>
                <div style={{
                  position: "absolute" as const,
                  top: "1rem",
                  right: "1rem",
                  fontSize: "1.5rem",
                  color: "#8b6914"
                }}>❈</div>
                
                <div style={{
                  textAlign: "center" as const,
                  padding: "2rem"
                }}>
                  <div style={{
                    fontSize: "5rem",
                    background: "linear-gradient(135deg, #8b6914 0%, #d4af37 100%)",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                    backgroundClip: "text",
                    marginBottom: "1rem"
                  }}>◈</div>
                  <div style={{
                    fontSize: "0.9rem",
                    color: "#8b6914",
                    letterSpacing: "0.2em",
                    fontWeight: 600
                  }}>{book.category}</div>
                </div>
              </div>
              
              <div style={{ padding: "2rem 1.5rem" }}>
                <h3 style={{
                  fontSize: "1.5rem",
                  fontWeight: 900,
                  color: "#FFD700",
                  marginBottom: "0.75rem",
                  lineHeight: 1.3,
                  letterSpacing: "0.05em"
                }}>
                  {book.title}
                </h3>
                <p style={{
                  fontSize: "1.1rem",
                  color: "#c9a961",
                  fontStyle: "italic",
                  marginBottom: "0.5rem"
                }}>
                  {book.author}
                </p>
                <div style={{
                  fontSize: "0.85rem",
                  color: "#8b7355",
                  letterSpacing: "0.1em"
                }}>
                  Anno Domini {book.year}
                </div>
                
                <div style={{
                  marginTop: "1.5rem",
                  paddingTop: "1rem",
                  borderTop: "1px solid #8b6914",
                  textAlign: "center" as const,
                  color: "#8b6914",
                  fontSize: "1.2rem"
                }}>
                  ⟡
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Characteristics Panel */}
        <div style={{
          background: "linear-gradient(135deg, #1a1410 0%, #0f0a08 100%)",
          border: "3px solid #8b6914",
          borderRadius: "4px",
          padding: "3rem",
          marginTop: "3rem",
          position: "relative" as const,
          boxShadow: "0 15px 50px rgba(0, 0, 0, 0.9), inset 0 2px 0 rgba(212, 175, 55, 0.2)"
        }}>
          <h3 style={{
            color: "#FFD700",
            fontSize: "2.5rem",
            marginBottom: "1.5rem",
            letterSpacing: "0.1em",
            textAlign: "center" as const,
            fontWeight: 900,
            textTransform: "uppercase" as const
          }}>
            ⟡ Baroque Splendor ⟡
          </h3>
          <p style={{
            color: "#c9a961",
            lineHeight: 2,
            marginBottom: "2rem",
            fontSize: "1.1rem",
            textAlign: "center" as const,
            fontStyle: "italic"
          }}>
            Inspired by 17th-century European grandeur, this theme embodies the opulence of royal courts and cathedral majesty. Ornate scrollwork, dramatic contrasts, and gilded embellishments create an atmosphere of timeless magnificence.
          </p>
          
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: "1.5rem",
            marginTop: "2rem"
          }}>
            {[
              { icon: "❈", label: "Ornate Scrollwork", desc: "Elaborate flourishes" },
              { icon: "◈", label: "Metallic Gold", desc: "Gilded accents" },
              { icon: "⟡", label: "High Drama", desc: "Rich contrasts" },
              { icon: "⟐", label: "Classical Motifs", desc: "Architectural details" }
            ].map((feature, idx) => (
              <div key={idx} style={{
                background: "rgba(139, 105, 20, 0.15)",
                border: "2px solid #8b6914",
                borderRadius: "4px",
                padding: "1.5rem",
                textAlign: "center" as const,
                transition: "all 0.3s"
              }}>
                <div style={{
                  fontSize: "3rem",
                  marginBottom: "1rem",
                  background: "linear-gradient(135deg, #8b6914 0%, #d4af37 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text"
                }}>{feature.icon}</div>
                <div style={{
                  fontSize: "1.1rem",
                  color: "#d4af37",
                  fontWeight: 700,
                  marginBottom: "0.5rem",
                  letterSpacing: "0.05em"
                }}>{feature.label}</div>
                <div style={{
                  fontSize: "0.9rem",
                  color: "#8b7355",
                  fontStyle: "italic"
                }}>{feature.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}