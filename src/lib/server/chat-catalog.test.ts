import { expect, it, vi } from "vitest";
const findMany = vi.hoisted(() => vi.fn());
vi.mock("server-only",()=>({}));
vi.mock("./prisma",()=>({prisma:{product:{findMany}}}));
import { getChatCatalog } from "./chat-catalog";
it("selects only public context and preserves exact variant prices/zero stock on each call",async()=>{
 const products=[{name:"Camiseta",description:"Algodón",basePriceCents:1990,category:{name:"Camisetas"},variants:[{size:"M",color:"Azul",priceCents:2190,stock:0}]}];
 findMany.mockResolvedValue(products);
 expect(await getChatCatalog()).toEqual({currency:"EUR",priceUnit:"céntimos",products});
 await getChatCatalog(); expect(findMany).toHaveBeenCalledTimes(2);
 expect(findMany).toHaveBeenCalledWith({orderBy:[{name:"asc"},{id:"asc"}],select:{name:true,description:true,basePriceCents:true,category:{select:{name:true}},variants:{orderBy:[{size:"asc"},{color:"asc"}],select:{size:true,color:true,priceCents:true,stock:true}}}});
});
