import { setDefaultAddress } from "@/services/address.service"

export async function POST(req: Request) {
  const { userId, addressId } = await req.json()

  const result = await setDefaultAddress(userId, addressId)

  return Response.json(result)
}