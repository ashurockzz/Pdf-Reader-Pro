import { Approuter } from "@/trpc"
import {createTRPCReact} from "@trpc/react-query"

export const trpc = createTRPCReact<Approuter>({})