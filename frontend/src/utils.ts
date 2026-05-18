function extractErrorMessage(err: unknown): string {
  const error = err as Record<string, unknown>
  const errDetail = error?.detail
  if (Array.isArray(errDetail) && errDetail.length > 0) {
    return (errDetail[0] as { msg: string }).msg
  }
  if (typeof errDetail === "string") return errDetail
  return "Что-то пошло не так."
}

export const handleError = function (
  this: (msg: string) => void,
  err: unknown,
) {
  const errorMessage = extractErrorMessage(err)
  this(errorMessage)
}

export const getInitials = (name: string): string => {
  return name
    .split(" ")
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase()
}
