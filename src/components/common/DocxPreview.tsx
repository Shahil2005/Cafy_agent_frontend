import { useEffect, useRef, useState } from 'react';
import * as docx from 'docx-preview';

interface DocxPreviewProps {
    url: string;
}

export default function DocxPreview({ url }: DocxPreviewProps) {
    const parentRef = useRef<HTMLDivElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [scale, setScale] = useState(1);

    // 1. DYNAMIC SCALING: Fit to Width
    useEffect(() => {
        if (!parentRef.current || !containerRef.current) return;

        const resizeObserver = new ResizeObserver((entries) => {
            for (const entry of entries) {
                const availableWidth = entry.contentRect.width - 48; // padding/margin
                
                // Find the actual rendered width of the primary DOCX section
                const docSection = containerRef.current?.querySelector('section.docx') as HTMLElement;
                const docWidth = docSection?.offsetWidth || 816; // Fallback to 8.5in if not rendered yet
                
                const newScale = Math.min(1, availableWidth / docWidth);
                setScale(newScale);
            }
        });

        resizeObserver.observe(parentRef.current);
        return () => resizeObserver.disconnect();
    }, [loading]); // Re-calculate scaling whenever loading state changes

    // 2. RENDERING LOGIC
    useEffect(() => {
        if (!url || !containerRef.current) return;

        let isMounted = true;

        const renderDoc = async () => {
            try {
                setLoading(true);
                
                const response = await fetch(url);
                if (!response.ok) throw new Error("Failed to fetch document");
                const blob = await response.blob();
                const arrayBuffer = await blob.arrayBuffer();

                if (containerRef.current) {
                    // Clear existing content to avoid duplication
                    containerRef.current.innerHTML = '';
                    
                    await docx.renderAsync(arrayBuffer, containerRef.current, undefined, {
                        className: 'docx',
                        inWrapper: true,
                        ignoreWidth: false, // CRITICAL: Use the document's native width from XML
                        ignoreHeight: false, 
                        ignoreFonts: false, // Allow custom fonts if provided
                        breakPages: true,
                        ignoreLastRenderedPageBreak: true,
                        experimental: true,
                        trimXmlDeclaration: true,
                        useBase64URL: true
                    });
                }
            } catch (err: any) {
                console.error("Docx Preview Error:", err);
                if (isMounted) setError("Failed to render the document visually.");
            } finally {
                if (isMounted) setLoading(false);
            }
        };

        renderDoc();

        return () => {
            isMounted = false;
        };
    }, [url]);

    if (error) {
        return <div className="p-8 text-sm text-rose-500 font-medium bg-rose-50 text-center rounded-xl m-4">{error}</div>;
    }

    return (
        <div className="w-full h-full relative bg-white overflow-hidden flex flex-col">
            {/* Global overrides for docx-preview internals to ensure premium high-fidelity look */}
            <style>
                {`
                    .docx-wrapper {
                        background: transparent !important;
                        padding: 0 !important;
                        display: flex !important;
                        flex-direction: column !important;
                        align-items: center !important;
                        gap: 32px !important;
                        width: 100% !important;
                        font-family: "Calibri", "Segoe UI", "Roboto", "Times New Roman", serif;
                        line-height: 1.15;
                    }

                    .docx-wrapper > section.docx {
                        background: white !important;
                        box-shadow: 0 12px 32px rgba(0,0,0,0.12) !important;
                        border: 1px solid #e2e8f0 !important;
                        margin-bottom: 0 !important;
                        position: relative !important;
                        box-sizing: content-box !important; /* Standard Word behavior */
                        /* No fixed width here to allow XML margins to define it */
                    }

                    .docx-wrapper * {
                        box-sizing: border-box !important;
                    }

                    /* Ensure lists and tables don't get squashed by global styles */
                    .docx-wrapper ul, .docx-wrapper ol {
                        list-style-position: outside !important;
                        margin-left: 0 !important;
                        padding-left: 1.5rem !important; /* Standard Word indentation */
                    }

                    .docx-wrapper li {
                        margin-bottom: 0 !important;
                    }

                    .docx-wrapper > section.docx article {
                        width: 100% !important;
                        height: 100% !important;
                    }
                `}
            </style>

            {loading && (
                <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/50 backdrop-blur-sm">
                    <p className="text-sm font-bold text-slate-500 animate-pulse tracking-widest uppercase">Rendering Document...</p>
                </div>
            )}
            
            <div 
                ref={parentRef}
                className="flex-1 overflow-x-hidden overflow-y-auto custom-scrollbar bg-slate-100/60 py-8 scroll-smooth"
            >
                <div className="flex flex-col items-center w-full min-h-full">
                    <div 
                        ref={containerRef} 
                        className="origin-top transition-transform duration-200 ease-out shadow-inner"
                        style={{ 
                            transform: `scale(${scale})`,
                            width: 'max-content',
                            minHeight: '100%'
                        }}
                    />
                </div>
            </div>
        </div>
    );
}
