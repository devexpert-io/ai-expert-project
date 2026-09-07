import { expect, it, vi } from "vitest";
const findMany = vi.hoisted(() => vi.fn());
vi.mock("server-only",()=>({}));
vi.mock("./prisma",()=>({prisma:{product:{findMany}}}));
import { getChatCatalog } from "./chat-catalog";
it("selects only public context and preserves exact variant prices/zero stock on each call",async()=>{
 const products=[{id:"product-1",slug:"camiseta",name:"Camiseta",description:"Algodón",imageUrl:"https://placehold.co/camiseta",basePriceCents:1990,category:{name:"Camisetas"},variants:[{id:"variant-1",size:"M",color:"Azul",priceCents:2190,stock:0}]}];
 findMany.mockResolvedValue(products);
 expect(await getChatCatalog()).toEqual({currency:"EUR",priceUnit:"céntimos",products});
 await getChatCatalog(); expect(findMany).toHaveBeenCalledTimes(2);
 expect(findMany).toHaveBeenCalledWith({orderBy:[{name:"asc"},{id:"asc"}],select:{id:true,slug:true,name:true,description:true,imageUrl:true,basePriceCents:true,category:{select:{name:true}},variants:{orderBy:[{size:"asc"},{color:"asc"}],select:{id:true,size:true,color:true,priceCents:true,stock:true}}}});
});
