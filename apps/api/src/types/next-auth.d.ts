import "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      mustChangePassword: boolean;
      permissions: string[];
      roleNames: string[];
    };
  }
}
