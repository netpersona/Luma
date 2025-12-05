import { useLocation } from "wouter";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ArtNouveauDemo() {
  const [, setLocation] = useLocation();

  return (
    <div className="theme-demo-container" style={{
      fontFamily: "'Garamond', 'Georgia', serif",
      background: "linear-gradient(135deg, #f4ebe0 0%, #e8dcc8 100%)",
      color: "#4a3428",
      minHeight: "100vh",
      padding: "2rem",
      overflow: "auto"
    }}>
      <div style={{ maxWidth: "1400px", margin: "0 auto" }}>
        <Button
          onClick={() => setLocation("/")}
          variant="outline"
          style={{
            background: "rgba(255, 255, 255, 0.7)",
            border: "2px solid rgba(139, 90, 43, 0.4)",
            color: "#6d4c3d",
            marginBottom: "2rem",
            borderRadius: "2rem"
          }}
          data-testid="button-back"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Library
        </Button>

        {/* Art Nouveau Header with Flowing Lines */}
        <header style={{
          background: "linear-gradient(135deg, #faf5ed 0%, #f0e8d8 100%)",
          border: "4px solid #8b5a2b",
          borderRadius: "3rem",
          padding: "4rem 2rem",
          marginBottom: "3rem",
          boxShadow: "0 10px 30px rgba(139, 90, 43, 0.2)",
          position: "relative" as const,
          overflow: "hidden"
        }}>
          {/* Flowing organic corner decorations */}
          <svg style={{
            position: "absolute" as const,
            top: "1rem",
            left: "1rem",
            width: "120px",
            height: "120px",
            opacity: 0.4
          }}>
            <path d="M 10 60 Q 30 20, 60 30 T 110 50" stroke="#8b5a2b" strokeWidth="3" fill="none" />
            <path d="M 20 80 Q 40 40, 70 50 T 120 70" stroke="#8b5a2b" strokeWidth="2" fill="none" />
          </svg>
          
          <svg style={{
            position: "absolute" as const,
            top: "1rem",
            right: "1rem",
            width: "120px",
            height: "120px",
            opacity: 0.4,
            transform: "scaleX(-1)"
          }}>
            <path d="M 10 60 Q 30 20, 60 30 T 110 50" stroke="#8b5a2b" strokeWidth="3" fill="none" />
            <path d="M 20 80 Q 40 40, 70 50 T 120 70" stroke="#8b5a2b" strokeWidth="2" fill="none" />
          </svg>

          <div style={{ textAlign: "center" as const }}>
            <div style={{
              fontSize: "3rem",
              color: "#b8860b",
              marginBottom: "1.5rem"
            }}>🌸</div>
            
            <div style={{
              fontSize: "0.95rem",
              letterSpacing: "0.3em",
              color: "#8b5a2b",
              marginBottom: "1.5rem",
              fontWeight: 400,
              fontStyle: "italic"
            }}>~ A Celebration of Nature ~</div>
            
            <h1 style={{
              fontSize: "5rem",
              fontWeight: 400,
              color: "#6d4c3d",
              letterSpacing: "0.15em",
              marginBottom: "1rem",
              fontStyle: "italic",
              textShadow: "2px 2px 4px rgba(139, 90, 43, 0.1)"
            }}>
              Luma
            </h1>
            
            {/* Flowing decorative line */}
            <svg style={{
              width: "400px",
              height: "60px",
              margin: "1rem auto",
              display: "block"
            }}>
              <path d="M 0 30 Q 100 10, 200 30 T 400 30" stroke="#b8860b" strokeWidth="2" fill="none" />
              <circle cx="200" cy="30" r="8" fill="#b8860b" />
              <circle cx="100" cy="20" r="4" fill="#8b5a2b" />
              <circle cx="300" cy="20" r="4" fill="#8b5a2b" />
            </svg>
            
            <div style={{
              fontSize: "1.8rem",
              color: "#8b5a2b",
              letterSpacing: "0.2em",
              fontStyle: "italic",
              fontWeight: 300
            }}>
              Art Nouveau Edition
            </div>
          </div>
        </header>

        {/* Color Palette */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(5, 1fr)",
          gap: "1.5rem",
          margin: "2rem 0",
          padding: "2rem",
          background: "rgba(255, 255, 255, 0.6)",
          border: "3px solid rgba(139, 90, 43, 0.3)",
          borderRadius: "2rem"
        }}>
          {[
            { color: "#f4ebe0", label: "Pale Ivory", flower: "🌼" },
            { color: "linear-gradient(135deg, #8b5a2b 0%, #6d4c3d 100%)", label: "Walnut Brown", flower: "🌰" },
            { color: "linear-gradient(135deg, #b8860b 0%, #daa520 100%)", label: "Antique Gold", flower: "✨" },
            { color: "linear-gradient(135deg, #8b6f47 0%, #a0826d 100%)", label: "Terra Sienna", flower: "🍂" },
            { color: "#4a3428", label: "Deep Espresso", flower: "☕" }
          ].map((item, idx) => (
            <div key={idx} style={{ textAlign: "center" as const }}>
              <div style={{
                fontSize: "2.5rem",
                marginBottom: "0.5rem"
              }}>{item.flower}</div>
              <div style={{
                width: "100%",
                height: "110px",
                borderRadius: "2rem",
                marginBottom: "0.75rem",
                border: "3px solid rgba(139, 90, 43, 0.3)",
                boxShadow: "0 4px 15px rgba(139, 90, 43, 0.15)",
                background: item.color
              }} />
              <div style={{ fontSize: "0.9rem", color: "#6d4c3d", fontWeight: 600, fontStyle: "italic" }}>{item.label}</div>
            </div>
          ))}
        </div>

        {/* Sample Library */}
        <h2 style={{
          fontSize: "3rem",
          color: "#6d4c3d",
          margin: "3rem 0 2rem",
          fontWeight: 400,
          letterSpacing: "0.1em",
          textAlign: "center" as const,
          fontStyle: "italic",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "1.5rem"
        }}>
          <span style={{ fontSize: "2rem", color: "#b8860b" }}>✿</span>
          Natural Wonders
          <span style={{ fontSize: "2rem", color: "#b8860b" }}>✿</span>
        </h2>

        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(270px, 1fr))",
          gap: "2.5rem",
          marginBottom: "3rem"
        }}>
          {[
            { title: "The Awakening", author: "Kate Chopin", theme: "Freedom & Nature" },
            { title: "The Wind in the Willows", author: "Kenneth Grahame", theme: "Pastoral Life" },
            { title: "The Picture of Dorian Gray", author: "Oscar Wilde", theme: "Beauty & Art" },
            { title: "A Room of One's Own", author: "Virginia Woolf", theme: "Creative Expression" }
          ].map((book, idx) => (
            <div key={idx} style={{
              background: "linear-gradient(135deg, #faf5ed 0%, #f0e8d8 100%)",
              border: "4px solid #8b5a2b",
              borderRadius: "3rem",
              overflow: "hidden",
              boxShadow: "0 8px 25px rgba(139, 90, 43, 0.2)",
              position: "relative" as const
            }}>
              <div style={{
                width: "100%",
                aspectRatio: "2/3",
                background: `radial-gradient(circle at 30% 40%, rgba(184, 134, 11, 0.15) 0%, transparent 60%)`,
                display: "flex",
                flexDirection: "column" as const,
                alignItems: "center",
                justifyContent: "center",
                borderBottom: "4px solid #8b5a2b",
                padding: "2.5rem",
                position: "relative" as const
              }}>
                {/* Flowing floral border */}
                <div style={{
                  position: "absolute" as const,
                  top: "1.5rem",
                  left: "50%",
                  transform: "translateX(-50%)",
                  width: "70%",
                  textAlign: "center" as const
                }}>
                  <svg width="100%" height="60">
                    <path d="M 0 30 Q 50 10, 100 30 T 200 30" stroke="#b8860b" strokeWidth="2" fill="none" />
                  </svg>
                </div>
                
                <div style={{
                  fontSize: "5rem",
                  marginBottom: "1.5rem",
                  filter: "drop-shadow(0 3px 10px rgba(139, 90, 43, 0.2))"
                }}>🌿</div>
                
                <div style={{
                  fontSize: "0.9rem",
                  color: "#8b5a2b",
                  fontStyle: "italic",
                  textAlign: "center" as const
                }}>{book.theme}</div>
              </div>
              
              <div style={{ padding: "2rem" }}>
                <h3 style={{
                  fontSize: "1.6rem",
                  fontWeight: 400,
                  color: "#4a3428",
                  marginBottom: "0.75rem",
                  lineHeight: 1.3,
                  fontStyle: "italic"
                }}>
                  {book.title}
                </h3>
                <p style={{
                  fontSize: "1.1rem",
                  color: "#6d4c3d",
                  fontStyle: "italic",
                  marginBottom: "1.25rem"
                }}>
                  {book.author}
                </p>
                
                <div style={{
                  textAlign: "center" as const,
                  color: "#b8860b",
                  fontSize: "1.5rem"
                }}>
                  ❀
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Characteristics */}
        <div style={{
          background: "linear-gradient(135deg, #faf5ed 0%, #f0e8d8 100%)",
          border: "4px solid #8b5a2b",
          borderRadius: "3rem",
          padding: "3rem",
          marginTop: "3rem",
          boxShadow: "0 10px 30px rgba(139, 90, 43, 0.2)"
        }}>
          <h3 style={{
            color: "#6d4c3d",
            fontSize: "3rem",
            marginBottom: "1.5rem",
            letterSpacing: "0.1em",
            textAlign: "center" as const,
            fontWeight: 400,
            fontStyle: "italic"
          }}>
            Art Nouveau Beauty
          </h3>
          <p style={{
            color: "#6d4c3d",
            lineHeight: 2,
            marginBottom: "2rem",
            fontSize: "1.15rem",
            textAlign: "center" as const,
            fontStyle: "italic",
            maxWidth: "800px",
            margin: "0 auto 2rem"
          }}>
            Inspired by the organic forms of nature, Art Nouveau celebrates flowing lines, floral motifs, and the poetry of natural beauty. Every curve tells a story of growth and grace.
          </p>
          
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: "1.5rem",
            marginTop: "2rem"
          }}>
            {[
              { icon: "🌸", label: "Floral Motifs", desc: "Organic beauty" },
              { icon: "🌊", label: "Flowing Lines", desc: "Natural curves" },
              { icon: "✒️", label: "Hand-Lettered", desc: "Artistic type" },
              { icon: "🍃", label: "Botanical Forms", desc: "Nature inspired" }
            ].map((feature, idx) => (
              <div key={idx} style={{
                background: "rgba(184, 134, 11, 0.1)",
                border: "3px solid rgba(139, 90, 43, 0.3)",
                borderRadius: "2rem",
                padding: "2rem",
                textAlign: "center" as const
              }}>
                <div style={{
                  fontSize: "3.5rem",
                  marginBottom: "1rem",
                  filter: "drop-shadow(0 2px 8px rgba(139, 90, 43, 0.2))"
                }}>{feature.icon}</div>
                <div style={{
                  fontSize: "1.15rem",
                  color: "#6d4c3d",
                  fontWeight: 600,
                  marginBottom: "0.5rem",
                  fontStyle: "italic"
                }}>{feature.label}</div>
                <div style={{
                  fontSize: "0.95rem",
                  color: "#8b5a2b",
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