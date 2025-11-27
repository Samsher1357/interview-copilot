declare module 'pdf-parse' {
  interface PDFInfo {
    PDFFormatVersion?: string
    IsAcroFormPresent?: boolean
    IsXFAPresent?: boolean
    [key: string]: unknown
  }

  interface PDFData {
    numpages: number
    numrender: number
    info: PDFInfo
    metadata: Record<string, unknown> | null
    text: string
    version: string
  }

  interface PDFOptions {
    max?: number
    version?: string
    [key: string]: unknown
  }

  function pdfParse(data: Buffer, options?: PDFOptions): Promise<PDFData>
  export = pdfParse
}

