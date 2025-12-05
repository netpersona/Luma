import { useLocation } from "wouter";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ArtDecoDemo() {
  const [, setLocation] = useLocation();

  return (
    <div className="theme-demo-container" style={{
      fontFamily: "'Futura', 'Century Gothic', sans-serif",
      background: "linear-gradient(135deg, #0f1922 0%, #1a2332 100%)",
      color: "#e8d4a0",
      minHeight: "100vh",
      padding: "2rem",
      overflow: "auto"
    }}>
      <div style={{ maxWidth: "1400px", margin: "0 auto" }}>
        <Button
          onClick={() => setLocation("/")}
          variant="outline"
          style={{
            background: "rgba(212, 175, 55, 0.1)",
            border: "2px solid #d4af37",
            color: "#d4af37",
            marginBottom: "2rem",
            borderRadius: "2px"
          }}
          data-testid="button-back"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Library
        </Button>

        {/* Art Deco Header with Sunburst */}
        <header style={{
          background: "linear-gradient(135deg, #1a2842 0%, #2d3f5f 100%)",
          border: "3px solid #d4af37",
          borderRadius: "0",
          padding: "4rem 2rem",
          marginBottom: "3rem",
          boxShadow: "0 20px 60px rgba(0, 0, 0, 0.9), inset 0 0 0 1px rgba(212, 175, 55, 0.3)",
          position: "relative" as const,
          overflow: "hidden"
        }}>
          {/* Geometric corner elements */}
          <div style={{
            position: "absolute" as const,
            top: 0,
            left: 0,
            width: "80px",
            height: "80px",
            borderRight: "3px solid #d4af37",
            borderBottom: "3px solid #d4af37"
          }} />
          <div style={{
            position: "absolute" as const,
            top: 0,
            right: 0,
            width: "80px",
            height: "80px",
            borderLeft: "3px solid #d4af37",
            borderBottom: "3px solid #d4af37"
          }} />
          <div style={{
            position: "absolute" as const,
            bottom: 0,
            left: 0,
            width: "80px",
            height: "80px",
            borderRight: "3px solid #d4af37",
            borderTop: "3px solid #d4af37"
          }} />
          <div style={{
            position: "absolute" as const,
            bottom: 0,
            right: 0,
            width: "80px",
            height: "80px",
            borderLeft: "3px solid #d4af37",
            borderTop: "3px solid #d4af37"
          }} />

          <div style={{ textAlign: "center" as const, position: "relative" as const, zIndex: 1 }}>
            {/* Sunburst pattern */}
            <div style={{
              width: "150px",
              height: "150px",
              margin: "0 auto 2rem",
              background: `radial-gradient(circle, #FFD700 0%, #d4af37 50%, transparent 70%)`,
              clipPath: "polygon(50% 0%, 60% 40%, 100% 50%, 60% 60%, 50% 100%, 40% 60%, 0% 50%, 40% 40%)",
              filter: "drop-shadow(0 0 30px rgba(255, 215, 0, 0.6))"
            }} />
            
            <div style={{
              fontSize: "1rem",
              letterSpacing: "0.5em",
              color: "#d4af37",
              marginBottom: "1.5rem",
              fontWeight: 300,
              textTransform: "uppercase" as const
            }}>The Roaring Twenties Present</div>
            
            <h1 style={{
              fontSize: "5.5rem",
              fontWeight: 700,
              background: "linear-gradient(180deg, #FFD700 0%, #d4af37 50%, #8b6914 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
              letterSpacing: "0.2em",
              marginBottom: "1.5rem",
              textTransform: "uppercase" as const,
              lineHeight: 1.1
            }}>
              Luma
            </h1>
            
            <div style={{
              width: "300px",
              height: "3px",
              background: "linear-gradient(90deg, transparent, #d4af37, transparent)",
              margin: "2rem auto"
            }} />
            
            <div style={{
              fontSize: "1.5rem",
              color: "#c9a961",
              letterSpacing: "0.3em",
              textTransform: "uppercase" as const,
              fontWeight: 300
            }}>
              Art Deco Edition
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
          background: "rgba(26, 40, 66, 0.5)",
          border: "2px solid #d4af37"
        }}>
          {[
            { color: "#1a2842", label: "Midnight Blue", accent: "Background" },
            { color: "linear-gradient(135deg, #2d3f5f 0%, #4a5f7f 100%)", label: "Steel Blue", accent: "Surface" },
            { color: "linear-gradient(135deg, #FFD700 0%, #d4af37 100%)", label: "Champagne Gold", accent: "Primary" },
            { color: "#e74c3c", label: "Ruby Red", accent: "Jewel Tone" },
            { color: "#e8d4a0", label: "Cream", accent: "Text" }
          ].map((item, idx) => (
            <div key={idx} style={{ textAlign: "center" as const }}>
              <div style={{
                width: "100%",
                height: "120px",
                border: "2px solid #d4af37",
                marginBottom: "0.75rem",
                background: item.color,
                clipPath: "polygon(10% 0%, 90% 0%, 100% 10%, 100% 90%, 90% 100%, 10% 100%, 0% 90%, 0% 10%)"
              }} />
              <div style={{ fontSize: "0.9rem", color: "#d4af37", fontWeight: 700, marginBottom: "0.25rem", letterSpacing: "0.1em" }}>{item.label}</div>
              <div style={{ fontSize: "0.75rem", color: "#8b7355", textTransform: "uppercase" as const }}>{item.accent}</div>
            </div>
          ))}
        </div>

        {/* Sample Library */}
        <h2 style={{
          fontSize: "3rem",
          color: "#FFD700",
          margin: "4rem 0 2rem",
          fontWeight: 700,
          letterSpacing: "0.3em",
          textTransform: "uppercase" as const,
          textAlign: "center" as const,
          position: "relative" as const
        }}>
          <span style={{
            display: "inline-block",
            position: "relative" as const,
            padding: "0 2rem"
          }}>
            Distinguished Collection
            <div style={{
              position: "absolute" as const,
              bottom: "-10px",
              left: "50%",
              transform: "translateX(-50%)",
              width: "80%",
              height: "2px",
              background: "linear-gradient(90deg, transparent, #d4af37, transparent)"
            }} />
          </span>
        </h2>

        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
          gap: "2.5rem",
          marginBottom: "3rem"
        }}>
          {[
            { title: "The Great Gatsby", author: "F. Scott Fitzgerald", year: "1925", genre: "JAZZ AGE" },
            { title: "Metropolis", author: "Thea von Harbou", year: "1926", genre: "SCI-FI" },
            { title: "Manhattan Transfer", author: "John Dos Passos", year: "1925", genre: "MODERNIST" },
            { title: "Gentlemen Prefer Blondes", author: "Anita Loos", year: "1925", genre: "SATIRE" }
          ].map((book, idx) => (
            <div key={idx} style={{
              background: "linear-gradient(135deg, #2d3f5f 0%, #1a2842 100%)",
              border: "3px solid #d4af37",
              overflow: "hidden",
              boxShadow: "0 15px 40px rgba(0, 0, 0, 0.8)",
              position: "relative" as const
            }}>
              <div style={{
                width: "100%",
                aspectRatio: "2/3",
                background: `
                  linear-gradient(135deg, #1a2842 0%, #0f1922 100%),
                  repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(212, 175, 55, 0.1) 10px, rgba(212, 175, 55, 0.1) 20px)
                `,
                backgroundBlendMode: "overlay",
                display: "flex",
                flexDirection: "column" as const,
                alignItems: "center",
                justifyContent: "center",
                borderBottom: "3px solid #d4af37",
                padding: "2rem",
                position: "relative" as const
              }}>
                {/* Geometric art deco pattern */}
                <div style={{
                  width: "100px",
                  height: "100px",
                  border: "3px solid #d4af37",
                  transform: "rotate(45deg)",
                  marginBottom: "2rem",
                  position: "relative" as const
                }}>
                  <div style={{
                    position: "absolute" as const,
                    top: "50%",
                    left: "50%",
                    transform: "translate(-50%, -50%)",
                    width: "60px",
                    height: "60px",
                    border: "2px solid #FFD700"
                  }} />
                </div>
                
                <div style={{
                  fontSize: "0.8rem",
                  color: "#d4af37",
                  letterSpacing: "0.2em",
                  textTransform: "uppercase" as const,
                  fontWeight: 600
                }}>{book.genre}</div>
              </div>
              
              <div style={{ padding: "2rem 1.5rem", background: "#1a2842" }}>
                <h3 style={{
                  fontSize: "1.6rem",
                  fontWeight: 700,
                  color: "#FFD700",
                  marginBottom: "0.75rem",
                  letterSpacing: "0.1em",
                  textTransform: "uppercase" as const
                }}>
                  {book.title}
                </h3>
                <p style={{
                  fontSize: "1rem",
                  color: "#c9a961",
                  marginBottom: "0.5rem",
                  letterSpacing: "0.05em"
                }}>
                  {book.author}
                </p>
                <div style={{
                  fontSize: "0.85rem",
                  color: "#8b7355",
                  letterSpacing: "0.2em",
                  marginTop: "1rem",
                  paddingTop: "1rem",
                  borderTop: "1px solid #d4af37"
                }}>
                  {book.year}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Characteristics */}
        <div style={{
          background: "linear-gradient(135deg, #1a2842 0%, #2d3f5f 100%)",
          border: "3px solid #d4af37",
          padding: "3rem",
          marginTop: "3rem",
          position: "relative" as const
        }}>
          <h3 style={{
            color: "#FFD700",
            fontSize: "3rem",
            marginBottom: "1.5rem",
            letterSpacing: "0.2em",
            textAlign: "center" as const,
            fontWeight: 700,
            textTransform: "uppercase" as const
          }}>
            Art Deco Glamour
          </h3>
          <p style={{
            color: "#c9a961",
            lineHeight: 2,
            marginBottom: "2rem",
            fontSize: "1.1rem",
            textAlign: "center" as const,
            maxWidth: "800px",
            margin: "0 auto 2rem"
          }}>
            Inspired by the golden age of the 1920s, this theme embodies streamlined modernism, geometric precision, and luxurious sophistication. Jazz, champagne, and the promise of tomorrow.
          </p>
          
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: "1.5rem",
            marginTop: "2rem"
          }}>
            {[
              { icon: "◆", label: "Geometric Precision", desc: "Angular symmetry" },
              { icon: "☼", label: "Sunburst Motifs", desc: "Radiant patterns" },
              { icon: "◈", label: "Streamlined Luxury", desc: "Sleek modernism" },
              { icon: "♦", label: "Jewel Tones", desc: "Rich accents" }
            ].map((feature, idx) => (
              <div key={idx} style={{
                background: "rgba(212, 175, 55, 0.1)",
                border: "2px solid #d4af37",
                padding: "1.75rem",
                textAlign: "center" as const,
                clipPath: "polygon(10% 0%, 90% 0%, 100% 10%, 100% 90%, 90% 100%, 10% 100%, 0% 90%, 0% 10%)"
              }}>
                <div style={{
                  fontSize: "3.5rem",
                  marginBottom: "1rem",
                  background: "linear-gradient(135deg, #FFD700 0%, #d4af37 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text"
                }}>{feature.icon}</div>
                <div style={{
                  fontSize: "1.1rem",
                  color: "#d4af37",
                  fontWeight: 700,
                  marginBottom: "0.5rem",
                  letterSpacing: "0.1em",
                  textTransform: "uppercase" as const
                }}>{feature.label}</div>
                <div style={{
                  fontSize: "0.9rem",
                  color: "#8b7355"
                }}>{feature.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}