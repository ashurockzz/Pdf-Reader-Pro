import { db } from "@/db";
import { getKindeServerSession } from "@kinde-oss/kinde-auth-nextjs/server";
import { createUploadthing, type FileRouter } from "uploadthing/next";
//import { UploadThingError } from "uploadthing/server";
import { PDFLoader} from 'langchain/document_loaders/fs/pdf'
import { Loader } from "lucide-react";
import { Pinecone } from "@pinecone-database/pinecone";
import {OpenAIEmbeddings} from "@langchain/openai"
import { PineconeStore } from "@langchain/pinecone";

const f = createUploadthing();

export const ourFileRouter = {
  pdfUploader: f({ pdf: { maxFileSize: "4MB" } })
    .middleware(async ({}) => {
      const { getUser } = getKindeServerSession();
      const user = getUser();

      if (!user || !user.id) throw new Error("Unauthorized");

     

      return { userId: user.id };
    })
    .onUploadComplete(async ({ metadata, file }) => {
      const createdFile = await db.file.create({
        data: {
          key: file.key,
          name: file.name,
          userId: metadata.userId,
          url:  `https://utfs.io/f/${file.key}`,
          uploadStatus: "PROCESSING"
        }
      })

      try {
        const response = await fetch (`https://utfs.io/f/${file.key}`)
        const blob = await response.blob()

        const loader = new PDFLoader(blob)
        const pageLevelDocs = await loader.load()
        const pageAmt = pageLevelDocs.length

        //vectorize

        const pinecone = new Pinecone()
        const pineconeIndex = pinecone.Index("redoc")

        const embeddings = new OpenAIEmbeddings({
          openAIApiKey: process.env.OPENAI_API_KEY
        })

        await db.file.update({
          data : {
            uploadStatus: "SUCCESS"
          },
          where : {
            id: createdFile.id
          }
        })

        await PineconeStore.fromDocuments(pageLevelDocs, embeddings, {
          
          pineconeIndex,
          namespace: createdFile.id
        })
        
      } catch (err) {
        await db.file.update({
          data : {
            uploadStatus: "FAILED"
          },
          where : {
            id: createdFile.id
          }
        })
      }

    }),
} satisfies FileRouter;

export type OurFileRouter = typeof ourFileRouter;
