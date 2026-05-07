// Note: the `privateCreateUser` is only available when generating the client
// for local environments
import { client } from "../../src/client/client.gen"
import { privateCreateUser } from "../../src/client"

client.setConfig({
  baseUrl: `${process.env.VITE_API_URL}`,
})

export const createUser = async ({
  email,
  password,
}: {
  email: string
  password: string
}) => {
  return await privateCreateUser({
    body: {
      email,
      password,
      is_verified: true,
      full_name: "Test User",
    },
  })
}
