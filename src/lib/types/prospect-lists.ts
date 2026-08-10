export type ProspectList = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
};

export type ProspectListWithCount = ProspectList & { contactCount: number };
