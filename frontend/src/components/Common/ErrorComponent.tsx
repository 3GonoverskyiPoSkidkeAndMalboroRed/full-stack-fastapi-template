import { Link } from "@tanstack/react-router"
import { Button } from "@/components/ui/button"

const ErrorComponent = () => {
  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center p-4"
      data-testid="error-component"
    >
      <div className="z-10 flex items-center">
        <div className="ml-4 flex flex-col items-center justify-center p-4">
          <span className="mb-4 text-6xl leading-none font-bold md:text-8xl">
            Ошибка
          </span>
          <span className="mb-2 text-2xl font-bold">Упс!</span>
        </div>
      </div>

      <p className="text-muted-foreground z-10 mb-4 text-center text-lg">
        Что-то пошло не так. Попробуйте ещё раз.
      </p>
      <Link to="/">
        <Button>На главную</Button>
      </Link>
    </div>
  )
}

export default ErrorComponent
