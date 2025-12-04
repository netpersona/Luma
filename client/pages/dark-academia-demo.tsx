import { useLocation } from "wouter";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function DarkAcademiaDemo() {
  const [, setLocation] = useLocation();

  return (
    <div className="theme-demo-container" style={{
      fontFamily: "'Crimson Text', 'Georgia', serif",
      background: "linear-gradient(135deg, #1a1410 0%, #0f0a08 100%)",
      color: "#d4c5a9",
      minHeight: "100vh",
      padding: "2rem",
      overflow: "auto",
      backgroundImage: `
        radial-gradient(circle at 15% 25%, rgba(139, 105, 20, 0.08) 0%, transparent 40%),
        radial-gradient(circle at 85% 75%, rgba(70, 50, 30, 0.06) 0%, transparent 40%)
      `
    }}>
      <div style={{ maxWidth: "1400px", margin: "0 auto" }}>
        <Button
          onClick={() => setLocation("/")}
          variant="outline"
          style={{
            background: "rgba(139, 105, 20, 0.15)",
            border: "2px solid #8b6914",
            color: "#c9a961",
            marginBottom: "2rem",
            borderRadius: "2px"
          }}
          data-testid="button-back"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Library
        </Button>

        {/* Dark Academia Header */}
        <header style={{
          background: "linear-gradient(135deg, #2d1f1a 0%, #1a1410 100%)",
          border: "2px solid #8b6914",
          borderRadius: "4px",
          padding: "4rem 2.5rem",
          marginBottom: "3rem",
          boxShadow: `
            0 25px 70px rgba(0, 0, 0, 0.95),
            inset 0 0 50px rgba(139, 105, 20, 0.1),
            0 0 30px rgba(139, 105, 20, 0.15)
          `,
          position: "relative" as const,
          overflow: "hidden"
        }}>
          {/* Mystical corner symbols */}
          <div style={{
            position: "absolute" as const,
            top: "1.5rem",
            left: "1.5rem",
            fontSize: "2rem",
            color: "#8b6914",
            opacity: 0.5
          }}>☽</div>
          <div style={{
            position: "absolute" as const,
            top: "1.5rem",
            right: "1.5rem",
            fontSize: "2rem",
            color: "#8b6914",
            opacity: 0.5
          }}>☾</div>
          <div style={{
            position: "absolute" as const,
            bottom: "1.5rem",
            left: "50%",
            transform: "translateX(-50%)",
            fontSize: "1.5rem",
            color: "#8b6914",
            opacity: 0.5
          }}>✦</div>

          <div style={{ textAlign: "center" as const }}>
            <div style={{
              fontSize: "3.5rem",
              color: "#c9a961",
              marginBottom: "1.5rem",
              filter: "drop-shadow(0 0 20px rgba(201, 169, 97, 0.4))"
            }}>🕯️</div>
            
            <div style={{
              fontSize: "0.95rem",
              letterSpacing: "0.4em",
              color: "#8b6914",
              marginBottom: "1.5rem",
              fontWeight: 400,
              textTransform: "uppercase" as const,
              fontStyle: "italic"
            }}>~ Arcane Knowledge Awaits ~</div>
            
            <h1 style={{
              fontSize: "5.5rem",
              fontWeight: 400,
              background: "linear-gradient(180deg, #d4c5a9 0%, #c9a961 50%, #8b6914 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
              letterSpacing: "0.15em",
              marginBottom: "1.5rem",
              fontFamily: "'Cinzel', serif",
              textShadow: "0 0 30px rgba(201, 169, 97, 0.3)"
            }}>
              Luma
            </h1>
            
            <div style={{
              width: "350px",
              height: "2px",
              background: "linear-gradient(90deg, transparent, #8b6914, transparent)",
              margin: "2rem auto",
              position: "relative" as const
            }}>
              <div style={{
                position: "absolute" as const,
                top: "-4px",
                left: "50%",
                transform: "translateX(-50%)",
                fontSize: "1.2rem",
                color: "#8b6914"
              }}>✦</div>
            </div>
            
            <div style={{
              fontSize: "1.6rem",
              color: "#c9a961",
              letterSpacing: "0.25em",
              fontStyle: "italic",
              textTransform: "uppercase" as const
            }}>
              Dark Academia Edition
            </div>
            
            <div style={{
              marginTop: "2rem",
              fontSize: "0.9rem",
              color: "#8b7355",
              fontStyle: "italic",
              letterSpacing: "0.1em"
            }}>
              "In books, we find magic"
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
          background: "rgba(45, 31, 26, 0.5)",
          border: "2px solid #8b6914",
          borderRadius: "4px"
        }}>
          {[
            { color: "#1a1410", label: "Obsidian", symbol: "🌑" },
            { color: "linear-gradient(135deg, #2d1f1a 0%, #3d2f2a 100%)", label: "Ancient Leather", symbol: "📜" },
            { color: "linear-gradient(135deg, #8b6914 0%, #c9a961 100%)", label: "Candlelight Gold", symbol: "🕯️" },
            { color: "#704214", label: "Old Parchment", symbol: "📖" },
            { color: "#d4c5a9", label: "Faded Ink", symbol: "✒️" }
          ].map((item, idx) => (
            <div key={idx} style={{ textAlign: "center" as const }}>
              <div style={{
                fontSize: "2rem",
                marginBottom: "0.5rem"
              }}>{item.symbol}</div>
              <div style={{
                width: "100%",
                height: "120px",
                border: "2px solid #8b6914",
                marginBottom: "0.75rem",
                background: item.color,
                boxShadow: "0 10px 30px rgba(0, 0, 0, 0.9), inset 0 0 25px rgba(139, 105, 20, 0.1)"
              }} />
              <div style={{
                fontSize: "0.9rem",
                color: "#c9a961",
                fontWeight: 600,
                marginBottom: "0.25rem",
                letterSpacing: "0.05em",
                fontStyle: "italic"
              }}>{item.label}</div>
            </div>
          ))}
        </div>

        {/* Sample Library */}
        <h2 style={{
          fontSize: "3rem",
          color: "#d4c5a9",
          margin: "4rem 0 2.5rem",
          fontWeight: 400,
          letterSpacing: "0.2em",
          textAlign: "center" as const,
          fontFamily: "'Cinzel', serif",
          textShadow: "0 0 15px rgba(212, 197, 169, 0.3)",
          borderTop: "1px solid #8b6914",
          borderBottom: "1px solid #8b6914",
          padding: "1.5rem 0",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "1.5rem"
        }}>
          <span style={{ fontSize: "1.5rem", color: "#8b6914" }}>✦</span>
          Forbidden Archives
          <span style={{ fontSize: "1.5rem", color: "#8b6914" }}>✦</span>
        </h2>

        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
          gap: "2.5rem",
          marginBottom: "3rem"
        }}>
          {[
            { title: "The Secret History", author: "Donna Tartt", theme: "Classical Studies" },
            { title: "If We Were Villains", author: "M.L. Rio", theme: "Shakespearean Drama" },
            { title: "The Name of the Rose", author: "Umberto Eco", theme: "Medieval Mystery" },
            { title: "Jonathan Strange & Mr Norrell", author: "Susanna Clarke", theme: "English Magic" }
          ].map((book, idx) => (
            <div key={idx} style={{
              background: "linear-gradient(135deg, #2d1f1a 0%, #1a1410 100%)",
              border: "2px solid #8b6914",
              borderRadius: "4px",
              overflow: "hidden",
              boxShadow: `
                0 18px 50px rgba(0, 0, 0, 0.95),
                inset 0 0 35px rgba(139, 105, 20, 0.12),
                0 0 20px rgba(139, 105, 20, 0.2)
              `,
              position: "relative" as const
            }}>
              <div style={{
                width: "100%",
                aspectRatio: "2/3",
                background: `
                  linear-gradient(135deg, #3d2f2a 0%, #2d1f1a 100%),
                  radial-gradient(circle at 50% 30%, rgba(139, 105, 20, 0.15) 0%, transparent 60%)
                `,
                backgroundBlendMode: "overlay",
                display: "flex",
                flexDirection: "column" as const,
                alignItems: "center",
                justifyContent: "center",
                borderBottom: "2px solid #8b6914",
                padding: "2.5rem",
                position: "relative" as const
              }}>
                {/* Occult circle */}
                <div style={{
                  width: "120px",
                  height: "120px",
                  border: "3px solid #8b6914",
                  borderRadius: "50%",
                  position: "relative" as const,
                  marginBottom: "1.5rem",
                  boxShadow: "inset 0 0 30px rgba(139, 105, 20, 0.2), 0 0 20px rgba(139, 105, 20, 0.3)"
                }}>
                  <div style={{
                    position: "absolute" as const,
                    top: "50%",
                    left: "50%",
                    transform: "translate(-50%, -50%)",
                    fontSize: "2.5rem",
                    color: "#c9a961",
                    filter: "drop-shadow(0 0 15px rgba(201, 169, 97, 0.6))"
                  }}>✦</div>
                  
                  {/* Small stars around circle */}
                  <div style={{
                    position: "absolute" as const,
                    top: "-5px",
                    left: "50%",
                    transform: "translateX(-50%)",
                    fontSize: "0.8rem",
                    color: "#8b6914"
                  }}>✦</div>
                  <div style={{
                    position: "absolute" as const,
                    bottom: "-5px",
                    left: "50%",
                    transform: "translateX(-50%)",
                    fontSize: "0.8rem",
                    color: "#8b6914"
                  }}>✦</div>
                </div>
                
                <div style={{
                  fontSize: "0.85rem",
                  color: "#8b6914",
                  letterSpacing: "0.15em",
                  textTransform: "uppercase" as const,
                  fontStyle: "italic"
                }}>{book.theme}</div>
              </div>
              
              <div style={{ padding: "2rem 1.75rem", background: "#1a1410" }}>
                <h3 style={{
                  fontSize: "1.6rem",
                  fontWeight: 400,
                  color: "#d4c5a9",
                  marginBottom: "0.75rem",
                  lineHeight: 1.3,
                  letterSpacing: "0.05em",
                  fontStyle: "italic"
                }}>
                  {book.title}
                </h3>
                <p style={{
                  fontSize: "1.05rem",
                  color: "#c9a961",
                  fontStyle: "italic",
                  marginBottom: "1.25rem"
                }}>
                  {book.author}
                </p>
                
                <div style={{
                  textAlign: "center" as const,
                  paddingTop: "1rem",
                  borderTop: "1px solid #8b6914",
                  color: "#8b6914",
                  fontSize: "1.2rem"
                }}>
                  ✦
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Characteristics */}
        <div style={{
          background: "linear-gradient(135deg, #2d1f1a 0%, #1a1410 100%)",
          border: "2px solid #8b6914",
          borderRadius: "4px",
          padding: "3.5rem",
          marginTop: "3rem",
          boxShadow: `
            0 25px 70px rgba(0, 0, 0, 0.95),
            inset 0 0 50px rgba(139, 105, 20, 0.1)
          `
        }}>
          <h3 style={{
            color: "#d4c5a9",
            fontSize: "3rem",
            marginBottom: "1.5rem",
            letterSpacing: "0.15em",
            textAlign: "center" as const,
            fontWeight: 400,
            fontFamily: "'Cinzel', serif",
            textShadow: "0 0 20px rgba(212, 197, 169, 0.3)"
          }}>
            ✦ Dark Academia Mystique ✦
          </h3>
          <p style={{
            color: "#c9a961",
            lineHeight: 2.2,
            marginBottom: "2rem",
            fontSize: "1.15rem",
            textAlign: "center" as const,
            fontStyle: "italic",
            maxWidth: "850px",
            margin: "0 auto 2.5rem"
          }}>
            Where scholarly pursuit meets mystical tradition. This aesthetic blends the intellectual rigor of academia with the allure of occult knowledge — candlelit libraries, ancient tomes, and the quiet magic of learning in shadow.
          </p>
          
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: "1.5rem",
            marginTop: "2rem"
          }}>
            {[
              { icon: "📚", label: "Ancient Tomes", desc: "Forbidden knowledge" },
              { icon: "🕯️", label: "Candlelight", desc: "Mystical ambiance" },
              { icon: "✒️", label: "Calligraphy", desc: "Scholarly elegance" },
              { icon: "🌙", label: "Nocturnal Study", desc: "Midnight wisdom" }
            ].map((feature, idx) => (
              <div key={idx} style={{
                background: "rgba(139, 105, 20, 0.12)",
                border: "2px solid #8b6914",
                borderRadius: "4px",
                padding: "2rem",
                textAlign: "center" as const,
                boxShadow: "inset 0 0 25px rgba(139, 105, 20, 0.08)"
              }}>
                <div style={{
                  fontSize: "3.5rem",
                  marginBottom: "1rem",
                  filter: "drop-shadow(0 0 15px rgba(201, 169, 97, 0.4))"
                }}>{feature.icon}</div>
                <div style={{
                  fontSize: "1.1rem",
                  color: "#d4c5a9",
                  fontWeight: 600,
                  marginBottom: "0.5rem",
                  letterSpacing: "0.05em",
                  fontStyle: "italic"
                }}>{feature.label}</div>
                <div style={{
                  fontSize: "0.95rem",
                  color: "#8b6914",
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