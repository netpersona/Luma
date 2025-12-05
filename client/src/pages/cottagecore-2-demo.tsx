import { useLocation } from "wouter";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Cottagecore2Demo() {
  const [, setLocation] = useLocation();

  return (
    <div className="theme-demo-container" style={{
      fontFamily: "'Georgia', serif",
      background: "#faf6ee",
      color: "#3d2f1f",
      minHeight: "100vh",
      padding: "2rem",
      overflow: "auto",
      backgroundImage: `
        repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(139, 101, 66, 0.03) 3px, rgba(139, 101, 66, 0.03) 6px),
        repeating-linear-gradient(90deg, transparent, transparent 3px, rgba(139, 101, 66, 0.03) 3px, rgba(139, 101, 66, 0.03) 6px)
      `
    }}>
      <div style={{ maxWidth: "1400px", margin: "0 auto" }}>
        <Button
          onClick={() => setLocation("/")}
          variant="outline"
          style={{
            background: "rgba(255, 255, 255, 0.8)",
            border: "2px solid rgba(139, 101, 66, 0.3)",
            color: "#5d4e37",
            marginBottom: "2rem",
            borderRadius: "2rem"
          }}
          data-testid="button-back"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Library
        </Button>

        {/* Vintage Book Cover Header */}
        <header style={{
          background: "linear-gradient(135deg, #fefdfb 0%, #f5ece0 100%)",
          border: "3px solid rgba(94, 78, 55, 0.4)",
          borderRadius: "2rem",
          padding: "3rem 2rem",
          marginBottom: "2.5rem",
          boxShadow: "0 6px 20px rgba(139, 101, 66, 0.15), inset 0 2px 0 rgba(255, 255, 255, 0.8)",
          position: "relative" as const,
          overflow: "hidden"
        }}>
          {/* Decorative vine corners */}
          <div style={{
            position: "absolute" as const,
            top: "1rem",
            left: "1rem",
            fontSize: "2.5rem",
            color: "#7a9d54",
            opacity: 0.6
          }}>🌿</div>
          <div style={{
            position: "absolute" as const,
            top: "1rem",
            right: "1rem",
            fontSize: "2.5rem",
            color: "#7a9d54",
            opacity: 0.6
          }}>🌿</div>

          <div style={{ textAlign: "center" as const }}>
            <div style={{
              fontSize: "0.9rem",
              letterSpacing: "0.25em",
              color: "#8b7355",
              marginBottom: "0.75rem",
              fontWeight: 400
            }}>~ A Collection of ~</div>
            
            <h1 style={{
              fontFamily: "'Georgia', serif",
              fontSize: "4rem",
              fontWeight: 700,
              color: "#5d4e37",
              marginBottom: "0.75rem",
              letterSpacing: "0.05em",
              fontStyle: "italic"
            }}>
              Luma
            </h1>
            
            <div style={{
              fontSize: "1.2rem",
              color: "#7a9d54",
              fontStyle: "italic",
              letterSpacing: "0.15em",
              marginBottom: "1rem"
            }}>
              Cottagecore Edition
            </div>
            
            <div style={{
              maxWidth: "600px",
              margin: "1.5rem auto 0",
              fontSize: "0.95rem",
              color: "#6d5d45",
              lineHeight: 1.8,
              fontStyle: "italic",
              borderTop: "1px solid rgba(139, 101, 66, 0.2)",
              borderBottom: "1px solid rgba(139, 101, 66, 0.2)",
              padding: "1rem 0"
            }}>
              A cozy sanctuary of timeless tales & pastoral charm
            </div>

            <div style={{
              marginTop: "1.5rem",
              fontSize: "1.8rem",
              color: "#daa520"
            }}>✿ ✿ ✿</div>
          </div>
        </header>

        {/* Color Palette */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(5, 1fr)",
          gap: "1.25rem",
          margin: "2rem 0",
          padding: "2rem",
          background: "rgba(255, 255, 255, 0.6)",
          border: "2px solid rgba(139, 101, 66, 0.2)",
          borderRadius: "2rem"
        }}>
          {[
            { color: "#faf6ee", label: "Cream Linen", flower: "🌼" },
            { color: "linear-gradient(135deg, #5d4e37 0%, #6d5d45 100%)", label: "Walnut Brown", flower: "🌰" },
            { color: "linear-gradient(135deg, #daa520 0%, #e6b840 100%)", label: "Wildflower Honey", flower: "🍯" },
            { color: "linear-gradient(135deg, #7a9d54 0%, #8fbc94 100%)", label: "Garden Sage", flower: "🌿" },
            { color: "#c17c74", label: "Terracotta Rose", flower: "🌹" }
          ].map((item, idx) => (
            <div key={idx} style={{ textAlign: "center" as const }}>
              <div style={{
                fontSize: "2rem",
                marginBottom: "0.5rem"
              }}>{item.flower}</div>
              <div style={{
                width: "100%",
                height: "100px",
                borderRadius: "1.5rem",
                marginBottom: "0.75rem",
                border: "3px solid rgba(139, 101, 66, 0.25)",
                boxShadow: "0 3px 12px rgba(139, 101, 66, 0.15)",
                background: item.color
              }} />
              <div style={{ fontSize: "0.9rem", color: "#5d4e37", fontWeight: 600 }}>{item.label}</div>
            </div>
          ))}
        </div>

        {/* Sample Library with Vintage Book Aesthetic */}
        <h2 style={{
          fontFamily: "'Georgia', serif",
          fontSize: "2.5rem",
          color: "#5d4e37",
          margin: "3rem 0 2rem",
          fontWeight: 700,
          letterSpacing: "0.05em",
          textAlign: "center" as const,
          fontStyle: "italic",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "1rem"
        }}>
          <span style={{ color: "#daa520", fontSize: "1.8rem" }}>❀</span>
          Your Cottage Library
          <span style={{ color: "#daa520", fontSize: "1.8rem" }}>❀</span>
        </h2>

        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
          gap: "2rem",
          marginBottom: "2.5rem"
        }}>
          {[
            { 
              title: "The Secret Garden", 
              author: "Frances Hodgson Burnett",
              subtitle: "A Tale of Nature's Magic",
              decoration: "🌿",
              borderColor: "#7a9d54"
            },
            { 
              title: "Anne of Green Gables", 
              author: "L.M. Montgomery",
              subtitle: "Adventures of a Spirited Orphan",
              decoration: "🍃",
              borderColor: "#8fbc94"
            },
            { 
              title: "Little Women", 
              author: "Louisa May Alcott",
              subtitle: "A Story of Sisterhood",
              decoration: "🌻",
              borderColor: "#daa520"
            },
            { 
              title: "A Year in Provence", 
              author: "Peter Mayle",
              subtitle: "Memoirs of Rural Life",
              decoration: "🌾",
              borderColor: "#c9a961"
            }
          ].map((book, idx) => (
            <div key={idx} style={{
              background: "linear-gradient(135deg, #fefdfb 0%, #f5ece0 100%)",
              border: `3px solid ${book.borderColor}40`,
              borderRadius: "2rem",
              overflow: "hidden",
              boxShadow: "0 6px 18px rgba(139, 101, 66, 0.12)",
              transition: "all 0.3s",
              position: "relative" as const
            }}>
              {/* Vintage book cover style */}
              <div style={{
                width: "100%",
                aspectRatio: "2/3",
                background: `linear-gradient(135deg, ${book.borderColor}15 0%, ${book.borderColor}05 100%)`,
                display: "flex",
                flexDirection: "column" as const,
                alignItems: "center",
                justifyContent: "center",
                borderBottom: `3px solid ${book.borderColor}40`,
                padding: "2rem",
                position: "relative" as const,
                overflow: "hidden"
              }}>
                {/* Decorative border frame */}
                <div style={{
                  position: "absolute" as const,
                  top: "1rem",
                  left: "1rem",
                  right: "1rem",
                  bottom: "1rem",
                  border: `2px solid ${book.borderColor}60`,
                  borderRadius: "1rem",
                  pointerEvents: "none" as const
                }} />
                
                <div style={{
                  fontSize: "4.5rem",
                  marginBottom: "1rem",
                  filter: "drop-shadow(0 2px 8px rgba(0,0,0,0.1))"
                }}>{book.decoration}</div>
                
                <div style={{
                  fontSize: "0.75rem",
                  color: "#8b7355",
                  letterSpacing: "0.2em",
                  textTransform: "uppercase" as const,
                  fontWeight: 600
                }}>Classic Tale</div>
              </div>
              
              <div style={{ padding: "1.75rem" }}>
                <h3 style={{
                  fontFamily: "'Georgia', serif",
                  fontSize: "1.4rem",
                  fontWeight: 700,
                  color: "#5d4e37",
                  marginBottom: "0.5rem",
                  lineHeight: 1.3,
                  fontStyle: "italic"
                }}>
                  {book.title}
                </h3>
                <p style={{
                  fontSize: "0.95rem",
                  color: "#8b7355",
                  fontStyle: "italic",
                  marginBottom: "0.75rem"
                }}>
                  by {book.author}
                </p>
                <div style={{
                  fontSize: "0.85rem",
                  color: "#6d5d45",
                  lineHeight: 1.6,
                  fontStyle: "italic",
                  borderTop: "1px solid rgba(139, 101, 66, 0.15)",
                  paddingTop: "0.75rem"
                }}>
                  {book.subtitle}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Characteristics Panel */}
        <div style={{
          background: "linear-gradient(135deg, #fefdfb 0%, #f5ece0 100%)",
          border: "3px solid rgba(139, 101, 66, 0.3)",
          borderRadius: "2rem",
          padding: "3rem",
          marginTop: "3rem",
          boxShadow: "0 6px 20px rgba(139, 101, 66, 0.15)"
        }}>
          <h3 style={{
            fontFamily: "'Georgia', serif",
            color: "#5d4e37",
            fontSize: "2.5rem",
            marginBottom: "1.5rem",
            letterSpacing: "0.05em",
            textAlign: "center" as const,
            fontWeight: 700,
            fontStyle: "italic"
          }}>
            ✿ Cottagecore Charm ✿
          </h3>
          <p style={{
            color: "#6d5d45",
            lineHeight: 2,
            marginBottom: "2rem",
            fontSize: "1.1rem",
            textAlign: "center" as const,
            fontStyle: "italic"
          }}>
            Inspired by vintage storybooks and pastoral living, this theme embraces the warmth of hand-lettered typography, soft floral motifs, and the gentle patina of well-loved books. A celebration of simple pleasures and timeless tales.
          </p>
          
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: "1.5rem",
            marginTop: "2rem"
          }}>
            {[
              { icon: "🌼", label: "Vintage Florals", desc: "Hand-drawn botanicals" },
              { icon: "🏡", label: "Storybook Style", desc: "Nostalgic charm" },
              { icon: "🍯", label: "Warm Palette", desc: "Honey & cream tones" },
              { icon: "☕", label: "Cozy Textures", desc: "Linen & parchment" }
            ].map((feature, idx) => (
              <div key={idx} style={{
                background: "rgba(218, 165, 32, 0.08)",
                border: "2px solid rgba(218, 165, 32, 0.25)",
                borderRadius: "1.5rem",
                padding: "1.75rem",
                textAlign: "center" as const
              }}>
                <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>{feature.icon}</div>
                <div style={{
                  fontSize: "1.1rem",
                  color: "#5d4e37",
                  fontWeight: 700,
                  marginBottom: "0.5rem"
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