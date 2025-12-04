import { useLocation } from "wouter";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function GothicDemo() {
  const [, setLocation] = useLocation();

  return (
    <div className="theme-demo-container" style={{
      fontFamily: "'Old English Text MT', 'Blackletter', serif",
      background: "#0a0408",
      color: "#e8d4e0",
      minHeight: "100vh",
      padding: "2rem",
      overflow: "auto",
      backgroundImage: `
        radial-gradient(circle at 20% 30%, rgba(88, 24, 69, 0.15) 0%, transparent 50%),
        radial-gradient(circle at 80% 70%, rgba(45, 20, 60, 0.1) 0%, transparent 50%)
      `
    }}>
      <div style={{ maxWidth: "1400px", margin: "0 auto" }}>
        <Button
          onClick={() => setLocation("/")}
          variant="outline"
          style={{
            background: "rgba(139, 0, 139, 0.15)",
            border: "2px solid #8b008b",
            color: "#d8a0d8",
            marginBottom: "2rem",
            borderRadius: "4px"
          }}
          data-testid="button-back"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Library
        </Button>

        {/* Gothic Header with Cathedral Arches */}
        <header style={{
          background: "linear-gradient(135deg, #1a0d1f 0%, #0f0612 100%)",
          border: "3px solid #8b008b",
          borderRadius: "4px",
          padding: "4rem 2rem",
          marginBottom: "3rem",
          boxShadow: `
            0 20px 60px rgba(0, 0, 0, 0.95),
            inset 0 0 40px rgba(139, 0, 139, 0.2),
            0 0 20px rgba(139, 0, 139, 0.3)
          `,
          position: "relative" as const,
          overflow: "hidden"
        }}>
          {/* Gothic arch patterns */}
          <div style={{
            position: "absolute" as const,
            top: 0,
            left: "20%",
            width: "60%",
            height: "100%",
            background: `radial-gradient(ellipse 200px 100px at 50% 0%, rgba(139, 0, 139, 0.15), transparent)`,
            clipPath: "polygon(0% 100%, 50% 0%, 100% 100%)",
            pointerEvents: "none" as const
          }} />

          <div style={{ textAlign: "center" as const, position: "relative" as const, zIndex: 1 }}>
            <div style={{
              fontSize: "4rem",
              color: "#8b008b",
              marginBottom: "1.5rem",
              filter: "drop-shadow(0 0 20px rgba(139, 0, 139, 0.8))"
            }}>✞</div>
            
            <div style={{
              fontSize: "0.9rem",
              letterSpacing: "0.4em",
              color: "#9370db",
              marginBottom: "1.5rem",
              fontWeight: 300,
              textTransform: "uppercase" as const,
              fontFamily: "'Garamond', serif"
            }}>~ Enter the Shadows ~</div>
            
            <h1 style={{
              fontSize: "6rem",
              fontWeight: 700,
              color: "#d8a0d8",
              letterSpacing: "0.1em",
              marginBottom: "1.5rem",
              textShadow: `
                0 0 30px rgba(139, 0, 139, 0.8),
                0 0 60px rgba(139, 0, 139, 0.4),
                3px 3px 0 rgba(0, 0, 0, 0.8)
              `,
              lineHeight: 1.1
            }}>
              Luma
            </h1>
            
            <div style={{
              width: "300px",
              height: "4px",
              background: "linear-gradient(90deg, transparent, #8b008b, transparent)",
              margin: "2rem auto",
              boxShadow: "0 0 10px rgba(139, 0, 139, 0.6)"
            }} />
            
            <div style={{
              fontSize: "1.8rem",
              color: "#9370db",
              letterSpacing: "0.3em",
              fontFamily: "'Garamond', serif",
              fontStyle: "italic",
              textTransform: "uppercase" as const
            }}>
              Gothic Edition
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
          background: "rgba(26, 13, 31, 0.6)",
          border: "2px solid #8b008b",
          borderRadius: "4px"
        }}>
          {[
            { color: "#0a0408", label: "Void Black", accent: "Background" },
            { color: "linear-gradient(135deg, #1a0d1f 0%, #2d143c 100%)", label: "Deep Purple", accent: "Surface" },
            { color: "linear-gradient(135deg, #8b008b 0%, #9370db 100%)", label: "Gothic Violet", accent: "Primary" },
            { color: "#dc143c", label: "Crimson", accent: "Accent" },
            { color: "#e8d4e0", label: "Pale Rose", accent: "Text" }
          ].map((item, idx) => (
            <div key={idx} style={{ textAlign: "center" as const }}>
              <div style={{
                width: "100%",
                height: "120px",
                border: "2px solid #8b008b",
                marginBottom: "0.75rem",
                background: item.color,
                boxShadow: "0 8px 25px rgba(0, 0, 0, 0.9), inset 0 0 20px rgba(139, 0, 139, 0.2)"
              }} />
              <div style={{
                fontSize: "0.9rem",
                color: "#d8a0d8",
                fontWeight: 700,
                marginBottom: "0.25rem",
                letterSpacing: "0.1em",
                fontFamily: "'Garamond', serif"
              }}>{item.label}</div>
              <div style={{
                fontSize: "0.75rem",
                color: "#9370db",
                fontFamily: "'Garamond', serif",
                fontStyle: "italic"
              }}>{item.accent}</div>
            </div>
          ))}
        </div>

        {/* Sample Library */}
        <h2 style={{
          fontSize: "3rem",
          color: "#d8a0d8",
          margin: "4rem 0 2.5rem",
          fontWeight: 700,
          letterSpacing: "0.2em",
          textAlign: "center" as const,
          textShadow: "0 0 20px rgba(139, 0, 139, 0.6)",
          borderTop: "2px solid #8b008b",
          borderBottom: "2px solid #8b008b",
          padding: "1.5rem 0"
        }}>
          ✞ Chronicles of Darkness ✞
        </h2>

        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
          gap: "2.5rem",
          marginBottom: "3rem"
        }}>
          {[
            { title: "Dracula", author: "Bram Stoker", year: "1897" },
            { title: "Wuthering Heights", author: "Emily Brontë", year: "1847" },
            { title: "The Fall of the House of Usher", author: "Edgar Allan Poe", year: "1839" },
            { title: "Carmilla", author: "Sheridan Le Fanu", year: "1872" }
          ].map((book, idx) => (
            <div key={idx} style={{
              background: "linear-gradient(135deg, #1a0d1f 0%, #0f0612 100%)",
              border: "3px solid #8b008b",
              borderRadius: "4px",
              overflow: "hidden",
              boxShadow: `
                0 15px 45px rgba(0, 0, 0, 0.95),
                inset 0 0 30px rgba(139, 0, 139, 0.15),
                0 0 15px rgba(139, 0, 139, 0.4)
              `,
              position: "relative" as const
            }}>
              <div style={{
                width: "100%",
                aspectRatio: "2/3",
                background: `
                  linear-gradient(135deg, #2d143c 0%, #1a0d1f 100%),
                  radial-gradient(circle at 50% 50%, rgba(139, 0, 139, 0.2) 0%, transparent 70%)
                `,
                backgroundBlendMode: "overlay",
                display: "flex",
                flexDirection: "column" as const,
                alignItems: "center",
                justifyContent: "center",
                borderBottom: "3px solid #8b008b",
                padding: "2rem",
                position: "relative" as const
              }}>
                {/* Gothic cathedral window pattern */}
                <div style={{
                  width: "100px",
                  height: "150px",
                  border: "3px solid #8b008b",
                  borderRadius: "50% 50% 0 0",
                  position: "relative" as const,
                  marginBottom: "1.5rem",
                  boxShadow: "inset 0 0 30px rgba(139, 0, 139, 0.3)"
                }}>
                  <div style={{
                    position: "absolute" as const,
                    top: "50%",
                    left: "50%",
                    transform: "translate(-50%, -50%)",
                    color: "#8b008b",
                    fontSize: "2.5rem",
                    filter: "drop-shadow(0 0 10px rgba(139, 0, 139, 0.8))"
                  }}>✞</div>
                </div>
                
                <div style={{
                  fontSize: "0.85rem",
                  color: "#9370db",
                  letterSpacing: "0.2em",
                  textTransform: "uppercase" as const,
                  fontFamily: "'Garamond', serif"
                }}>Gothic Classic</div>
              </div>
              
              <div style={{ padding: "2rem 1.5rem", background: "#0f0612" }}>
                <h3 style={{
                  fontSize: "1.8rem",
                  fontWeight: 700,
                  color: "#d8a0d8",
                  marginBottom: "0.75rem",
                  letterSpacing: "0.05em",
                  textShadow: "0 0 10px rgba(139, 0, 139, 0.4)"
                }}>
                  {book.title}
                </h3>
                <p style={{
                  fontSize: "1.1rem",
                  color: "#9370db",
                  fontStyle: "italic",
                  marginBottom: "0.75rem",
                  fontFamily: "'Garamond', serif"
                }}>
                  {book.author}
                </p>
                <div style={{
                  fontSize: "0.9rem",
                  color: "#8b008b",
                  letterSpacing: "0.15em",
                  marginTop: "1rem",
                  paddingTop: "1rem",
                  borderTop: "1px solid #8b008b",
                  fontFamily: "'Garamond', serif"
                }}>
                  Anno Domini {book.year}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Characteristics */}
        <div style={{
          background: "linear-gradient(135deg, #1a0d1f 0%, #0f0612 100%)",
          border: "3px solid #8b008b",
          borderRadius: "4px",
          padding: "3rem",
          marginTop: "3rem",
          boxShadow: `
            0 20px 60px rgba(0, 0, 0, 0.95),
            inset 0 0 40px rgba(139, 0, 139, 0.15)
          `
        }}>
          <h3 style={{
            color: "#d8a0d8",
            fontSize: "3rem",
            marginBottom: "1.5rem",
            letterSpacing: "0.15em",
            textAlign: "center" as const,
            fontWeight: 700,
            textShadow: "0 0 20px rgba(139, 0, 139, 0.6)"
          }}>
            ✞ Gothic Mystique ✞
          </h3>
          <p style={{
            color: "#9370db",
            lineHeight: 2,
            marginBottom: "2rem",
            fontSize: "1.15rem",
            textAlign: "center" as const,
            fontFamily: "'Garamond', serif",
            fontStyle: "italic",
            maxWidth: "800px",
            margin: "0 auto 2rem"
          }}>
            Rooted in medieval architecture and dark romanticism, Gothic design evokes mystery, spiritual depth, and the beauty found in shadows. A celebration of the sublime and supernatural.
          </p>
          
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: "1.5rem",
            marginTop: "2rem"
          }}>
            {[
              { icon: "✞", label: "Sacred Symbols", desc: "Spiritual motifs" },
              { icon: "🏰", label: "Cathedral Arches", desc: "Gothic architecture" },
              { icon: "🌙", label: "Dark Romance", desc: "Mysterious beauty" },
              { icon: "🕯️", label: "Candlelight", desc: "Atmospheric shadows" }
            ].map((feature, idx) => (
              <div key={idx} style={{
                background: "rgba(139, 0, 139, 0.15)",
                border: "2px solid #8b008b",
                borderRadius: "4px",
                padding: "1.75rem",
                textAlign: "center" as const,
                boxShadow: "inset 0 0 20px rgba(139, 0, 139, 0.1)"
              }}>
                <div style={{
                  fontSize: "3.5rem",
                  marginBottom: "1rem",
                  filter: "drop-shadow(0 0 15px rgba(139, 0, 139, 0.8))"
                }}>{feature.icon}</div>
                <div style={{
                  fontSize: "1.1rem",
                  color: "#d8a0d8",
                  fontWeight: 700,
                  marginBottom: "0.5rem",
                  letterSpacing: "0.05em",
                  fontFamily: "'Garamond', serif"
                }}>{feature.label}</div>
                <div style={{
                  fontSize: "0.9rem",
                  color: "#9370db",
                  fontFamily: "'Garamond', serif",
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