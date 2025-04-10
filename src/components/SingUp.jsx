import { useDispatch } from "react-redux";
import { useNavigate } from "react-router-dom";
import { getAuth, createUserWithEmailAndPassword } from "firebase/auth";
import Form from "./form/Form";
import { setUser } from "store/slices/userSlice";

const SignUp = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const handleRegister = (email, password) => {
    const auth = getAuth();

    createUserWithEmailAndPassword(auth, email, password)
      .then((userCredential) => {
        const user = userCredential.user;
        console.log("User registered:", user);

        dispatch(
          setUser({
            email: user.email,
            id: user.uid,
            token: user.accessToken,
          })
        );

        navigate("/"); // Перенаправлення на головну сторінку
      })
      .catch((error) => {
        console.error("Registration error:", error);
        alert(error.message); // Показуємо помилку користувачу
      });
  };

  return (
    <div>
      <Form title="Sing Up" handleClick={handleRegister} />
    </div>
  );
};

export default SignUp;
