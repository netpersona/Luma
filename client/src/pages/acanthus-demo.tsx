import { useLocation } from "wouter";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function AcanthusDemo() {
  const [, setLocation] = useLocation();

  return (
    <div className="theme-demo-container" style={{
      fontFamily: "'Trajan Pro', 'Times New Roman', serif",
      background: "linear-gradient(135deg, #e8e4dc 0%, #d4cfc4 100%)",
      color: "#2d3e2d",
      minHeight: "100vh",
      padding: "2rem",
      overflow: "auto",
      backgroundImage: `
        radial-gradient(circle at 30% 40%, rgba(122, 157, 84, 0.05) 0%, transparent 50%),
        radial-gradient(circle at 70% 60%, rgba(139, 105, 20, 0.03) 0%, transparent 50%)
      `
    }}>
      <div style={{ maxWidth: "1400px", margin: "0 auto" }}>
        <Button
          onClick={() => setLocation("/")}
          variant="outline"
          style={{
            background: "rgba(255, 255, 255, 0.7)",
            border: "2px solid rgba(122, 157, 84, 0.4)",
            color: "#4a5f4a",
            marginBottom: "2rem",
            borderRadius: "4px"
          }}
          data-testid="button-back"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Library
        </Button>

        {/* Classical Header with Acanthus Motifs */}
        <header style={{
          background: "linear-gradient(135deg, #f5f2eb 0%, #ebe8df 100%)",
          border: "3px solid #7a9d54",
          borderRadius: "2px",
          padding: "3.5rem 2rem",
          marginBottom: "3rem",
          boxShadow: "0 10px 30px rgba(74, 95, 74, 0.15), inset 0 2px 0 rgba(255, 255, 255, 0.6)",
          position: "relative" as const,
          overflow: "hidden"
        }}>
          {/* Acanthus leaf corner decorations */}
          <div style={{
            position: "absolute" as const,
            top: "1rem",
            left: "1rem",
            fontSize: "2.5rem",
            color: "#7a9d54",
            opacity: 0.7,
            transform: "rotate(-45deg)"
          }}>🍃</div>
          <div style={{
            position: "absolute" as const,
            top: "1rem",
            right: "1rem",
            fontSize: "2.5rem",
            color: "#7a9d54",
            opacity: 0.7,
            transform: "rotate(45deg) scaleX(-1)"
          }}>🍃</div>
          <div style={{
            position: "absolute" as const,
            bottom: "1rem",
            left: "1rem",
            fontSize: "2.5rem",
            color: "#7a9d54",
            opacity: 0.7,
            transform: "rotate(-135deg) scaleY(-1)"
          }}>🍃</div>
          <div style={{
            position: "absolute" as const,
            bottom: "1rem",
            right: "1rem",
            fontSize: "2.5rem",
            color: "#7a9d54",
            opacity: 0.7,
            transform: "rotate(135deg) scale(-1)"
          }}>🍃</div>

          <div style={{ textAlign: "center" as const, position: "relative" as const, zIndex: 1 }}>
            <div style={{
              fontSize: "0.95rem",
              letterSpacing: "0.35em",
              color: "#7a9d54",
              marginBottom: "1rem",
              fontWeight: 400,
              textTransform: "uppercase" as const
            }}>~ Classical Collection ~</div>
            
            <h1 style={{
              fontSize: "4.5rem",
              fontWeight: 700,
              background: "linear-gradient(135deg, #4a5f4a 0%, #7a9d54 50%, #4a5f4a 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
              letterSpacing: "0.15em",
              marginBottom: "1rem",
              textTransform: "uppercase" as const
            }}>
              Luma
            </h1>
            
            <div style={{
              fontSize: "1.3rem",
              color: "#8b6914",
              fontStyle: "italic",
              letterSpacing: "0.2em",
              marginBottom: "1.5rem"
            }}>
              Acanthus Edition
            </div>
            
            <div style={{
              maxWidth: "700px",
              margin: "0 auto",
              fontSize: "1rem",
              color: "#5f6f5f",
              lineHeight: 1.8,
              borderTop: "2px solid #7a9d54",
              borderBottom: "2px solid #7a9d54",
              padding: "1.25rem 0"
            }}>
              Where classical elegance meets natural beauty in timeless harmony
            </div>

            <div style={{
              marginTop: "1.5rem",
              fontSize: "1.5rem",
              color: "#7a9d54"
            }}>⟡ ❦ ⟡</div>
          </div>
        </header>

        {/* Color Palette */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(5, 1fr)",
          gap: "1.5rem",
          margin: "2rem 0",
          padding: "2rem",
          background: "rgba(255, 255, 255, 0.5)",
          border: "2px solid rgba(122, 157, 84, 0.3)",
          borderRadius: "2px"
        }}>
          {[
            { color: "linear-gradient(135deg, #e8e4dc 0%, #d4cfc4 100%)", label: "Marble Stone", desc: "Background" },
            { color: "linear-gradient(135deg, #7a9d54 0%, #668f44 100%)", label: "Acanthus Green", desc: "Primary" },
            { color: "linear-gradient(135deg, #8b6914 0%, #c9a961 100%)", label: "Classical Gold", desc: "Accent" },
            { color: "#5f6f5f", label: "Stone Gray", desc: "Secondary" },
            { color: "#2d3e2d", label: "Forest Deep", desc: "Text" }
          ].map((item, idx) => (
            <div key={idx} style={{ textAlign: "center" as const }}>
              <div style={{
                width: "100%",
                height: "110px",
                borderRadius: "2px",
                marginBottom: "0.75rem",
                border: "3px solid rgba(122, 157, 84, 0.4)",
                boxShadow: "0 4px 15px rgba(74, 95, 74, 0.15), inset 0 2px 8px rgba(255, 255, 255, 0.3)",
                background: item.color
              }} />
              <div style={{ fontSize: "0.95rem", color: "#4a5f4a", fontWeight: 700, marginBottom: "0.25rem" }}>{item.label}</div>
              <div style={{ fontSize: "0.8rem", color: "#7a8a7a", fontStyle: "italic" }}>{item.desc}</div>
            </div>
          ))}
        </div>

        {/* Sample Library with Classical Styling */}
        <h2 style={{
          fontSize: "2.5rem",
          color: "#4a5f4a",
          margin: "3rem 0 2rem",
          fontWeight: 700,
          letterSpacing: "0.15em",
          textTransform: "uppercase" as const,
          textAlign: "center" as const,
          borderTop: "3px solid #7a9d54",
          borderBottom: "3px solid #7a9d54",
          padding: "1.5rem 0"
        }}>
          ⟡ Distinguished Archives ⟡
        </h2>

        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(270px, 1fr))",
          gap: "2.5rem",
          marginBottom: "3rem"
        }}>
          {[
            { title: "Metamorphoses", author: "Ovid", era: "Classical Antiquity", symbol: "🏛️" },
            { title: "Symposium", author: "Plato", era: "Ancient Philosophy", symbol: "📜" },
            { title: "Aeneid", author: "Virgil", era: "Roman Epic", symbol: "⚔️" },
            { title: "Meditations", author: "Marcus Aurelius", era: "Stoic Wisdom", symbol: "🕊️" }
          ].map((book, idx) => (
            <div key={idx} style={{
              background: "linear-gradient(135deg, #f5f2eb 0%, #ebe8df 100%)",
              border: "3px solid #7a9d54",
              borderRadius: "2px",
              overflow: "hidden",
              boxShadow: "0 8px 25px rgba(74, 95, 74, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.5)",
              position: "relative" as const
            }}>
              {/* Decorative top border */}
              <div style={{
                height: "4px",
                background: "linear-gradient(90deg, transparent, #8b6914, transparent)"
              }} />
              
              <div style={{
                width: "100%",
                aspectRatio: "2/3",
                background: "linear-gradient(135deg, #d4cfc4 0%, #c4bfb4 100%)",
                display: "flex",
                flexDirection: "column" as const,
                alignItems: "center",
                justifyContent: "center",
                borderBottom: "3px solid #7a9d54",
                padding: "2rem",
                position: "relative" as const
              }}>
                {/* Acanthus leaf decorations */}
                <div style={{
                  position: "absolute" as const,
                  top: "1.5rem",
                  left: "50%",
                  transform: "translateX(-50%)",
                  fontSize: "1.5rem",
                  color: "#7a9d54"
                }}>🍃</div>
                
                <div style={{
                  fontSize: "5rem",
                  marginBottom: "1rem",
                  filter: "drop-shadow(0 3px 10px rgba(0,0,0,0.1))"
                }}>{book.symbol}</div>
                
                <div style={{
                  fontSize: "0.85rem",
                  color: "#5f6f5f",
                  letterSpacing: "0.2em",
                  textTransform: "uppercase" as const,
                  fontWeight: 600
                }}>{book.era}</div>
                
                {/* Bottom leaf decoration */}
                <div style={{
                  position: "absolute" as const,
                  bottom: "1.5rem",
                  fontSize: "1.2rem",
                  color: "#8b6914"
                }}>❦</div>
              </div>
              
              <div style={{ padding: "2rem 1.75rem" }}>
                <h3 style={{
                  fontSize: "1.6rem",
                  fontWeight: 700,
                  color: "#2d3e2d",
                  marginBottom: "0.75rem",
                  lineHeight: 1.3,
                  letterSpacing: "0.05em"
                }}>
                  {book.title}
                </h3>
                <p style={{
                  fontSize: "1.1rem",
                  color: "#5f6f5f",
                  fontStyle: "italic",
                  marginBottom: "1.25rem"
                }}>
                  {book.author}
                </p>
                
                <div style={{
                  borderTop: "2px solid rgba(122, 157, 84, 0.3)",
                  paddingTop: "1rem",
                  textAlign: "center" as const
                }}>
                  <div style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "0.5rem",
                    color: "#7a9d54",
                    fontSize: "1rem"
                  }}>
                    <span>🍃</span>
                    <span>⟡</span>
                    <span>🍃</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Characteristics Panel */}
        <div style={{
          background: "linear-gradient(135deg, #f5f2eb 0%, #ebe8df 100%)",
          border: "3px solid #7a9d54",
          borderRadius: "2px",
          padding: "3rem",
          marginTop: "3rem",
          boxShadow: "0 10px 30px rgba(74, 95, 74, 0.15), inset 0 2px 0 rgba(255, 255, 255, 0.5)"
        }}>
          <h3 style={{
            color: "#4a5f4a",
            fontSize: "2.5rem",
            marginBottom: "1.5rem",
            letterSpacing: "0.1em",
            textAlign: "center" as const,
            fontWeight: 700,
            textTransform: "uppercase" as const
          }}>
            ⟡ Acanthus Heritage ⟡
          </h3>
          <p style={{
            color: "#5f6f5f",
            lineHeight: 2,
            marginBottom: "2rem",
            fontSize: "1.1rem",
            textAlign: "center" as const
          }}>
            Rooted in the architectural ornamentation of classical antiquity, the acanthus leaf symbolizes endurance and organic elegance. This theme blends natural botanical motifs with the refined symmetry of Corinthian columns, creating a space of timeless sophistication.
          </p>
          
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: "1.5rem",
            marginTop: "2rem"
          }}>
            {[
              { icon: "🍃", label: "Acanthus Leaves", desc: "Classical motifs" },
              { icon: "🏛️", label: "Stone Textures", desc: "Marble elegance" },
              { icon: "❦", label: "Symmetrical Vines", desc: "Organic structure" },
              { icon: "⟡", label: "Natural Gold", desc: "Refined accents" }
            ].map((feature, idx) => (
              <div key={idx} style={{
                background: "rgba(122, 157, 84, 0.1)",
                border: "2px solid rgba(122, 157, 84, 0.3)",
                borderRadius: "2px",
                padding: "1.75rem",
                textAlign: "center" as const
              }}>
                <div style={{
                  fontSize: "3rem",
                  marginBottom: "1rem",
                  filter: "drop-shadow(0 2px 8px rgba(74, 95, 74, 0.2))"
                }}>{feature.icon}</div>
                <div style={{
                  fontSize: "1.1rem",
                  color: "#4a5f4a",
                  fontWeight: 700,
                  marginBottom: "0.5rem",
                  letterSpacing: "0.05em"
                }}>{feature.label}</div>
                <div style={{
                  fontSize: "0.9rem",
                  color: "#7a8a7a",
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