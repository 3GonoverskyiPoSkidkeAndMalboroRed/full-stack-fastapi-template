import DeleteConfirmation from "./DeleteConfirmation"

const DeleteAccount = () => {
  return (
    <div className="border-destructive/50 mt-4 max-w-md rounded-lg border p-4">
      <h3 className="text-destructive font-semibold">Удалить аккаунт</h3>
      <p className="text-muted-foreground mt-1 text-sm">
        Безвозвратно удалите свой аккаунт и все связанные данные.
      </p>
      <DeleteConfirmation />
    </div>
  )
}

export default DeleteAccount
