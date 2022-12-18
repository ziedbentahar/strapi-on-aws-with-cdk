export default ({ env }) => {
  const creds = env.json("DATABASE_CREDENTIALS", {
    username: "",
    password: "",
  });

  return {
    connection: {
      client: "postgres",
      connection: {
        host: env("DATABASE_HOST"),
        port: env.int("DATABASE_PORT"),
        database: env("DATABASE_NAME"),
        user: creds.username,
        password: creds.password,
        ssl: env.bool("DATABASE_SSL"),
      },
    },
  };
};
