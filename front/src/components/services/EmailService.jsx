import emailjs from "emailjs-com";

export const sendBirthdayEmail = (name, surname, email) => {
  const templateParams = {
    to_name: name,
    to_email: email,
    from_name: "Your App Name",
    message: `Joyeux anniversaire à ${name} ${surname}! Pensez a lui souhaiter`,
  };

  emailjs
    .send("YOUR_SERVICE_ID", "YOUR_TEMPLATE_ID", templateParams, "YOUR_USER_ID")
    .then(
      (response) => {
        console.log("SUCCESS!", response.status, response.text);
      },
      (err) => {
        console.error("FAILED...", err);
      }
    );
};
