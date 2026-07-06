import { Stack, useRouter } from "expo-router";
import DateForm from "../../components/DateForm";
import { createDate } from "../../lib/dates";

export default function NewDateScreen() {
  const router = useRouter();

  return (
    <>
      <Stack.Screen options={{ title: "Ajouter une date" }} />
      <DateForm
        submitLabel="Ajouter"
        onSubmit={async (payload) => {
          await createDate(payload);
          router.back();
        }}
      />
    </>
  );
}
