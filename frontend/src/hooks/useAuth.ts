import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"

import {
  type BodyLoginLoginAccessToken,
  loginLoginAccessToken,
  type UserPublic,
  type UserRegister,
  usersReadUserMe,
  usersRegisterUser,
} from "@/client"
import { handleError } from "@/utils"
import useCustomToast from "./useCustomToast"

const isLoggedIn = () => {
  return localStorage.getItem("access_token") !== null
}

const useAuth = () => {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { showErrorToast } = useCustomToast()

  const { data: user } = useQuery<UserPublic | null, Error>({
    queryKey: ["currentUser"],
    queryFn: async () => {
      const res = await usersReadUserMe()
      return res.data ?? null
    },
    enabled: isLoggedIn(),
  })

  const login = async (data: BodyLoginLoginAccessToken) => {
    const response = await loginLoginAccessToken({ body: data })
    localStorage.setItem("access_token", response.data!.access_token)
  }

  const signUpMutation = useMutation({
    mutationFn: async (data: UserRegister) => {
      await usersRegisterUser({ body: data })
      await login({ username: data.email, password: data.password })
    },
    onSuccess: () => {
      navigate({ to: "/" })
    },
    onError: handleError.bind(showErrorToast),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] })
      queryClient.invalidateQueries({ queryKey: ["currentUser"] })
    },
  })

  const loginMutation = useMutation({
    mutationFn: login,
    onSuccess: () => {
      navigate({ to: "/" })
    },
    onError: handleError.bind(showErrorToast),
  })

  const logout = () => {
    localStorage.removeItem("access_token")
    navigate({ to: "/login" })
  }

  return {
    signUpMutation,
    loginMutation,
    logout,
    user,
  }
}

export { isLoggedIn }
export default useAuth
