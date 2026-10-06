import { t } from "@/i18n";
import { Stack, useRouter } from "expo-router";
import DateForm from "../../components/DateForm";
import { createDate } from "../../lib/dates";

export default function NewDateScreen() {
  const router = useRouter();

  return (
    <>
      <Stack.Screen options={{ title: t("date:new.title") }} />
      <DateForm
        submitLabel={t("common:actions.add")}
        onSubmit={async (payload) => {
          await createDate(payload);
          router.back();
        }}
      />
    </>
  );
}
