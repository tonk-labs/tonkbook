export interface Source {
  id: string;
  title: string;
  path: string;
  noteId: string;
  metadata: {
    type: "text" | "pdf" | "csv" | "web" | "ai";
    createdAt: string;
  };
}

export interface ChatMessage {
  id: string;
  type: "user" | "assistant";
  content: string;
  timestamp: Date;
}
